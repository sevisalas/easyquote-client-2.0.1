import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const getEdgeFunctionErrorMessage = async (error: any) => {
  try {
    const response = error?.context;
    if (response?.json) {
      const body = await response.json();
      if (typeof body?.error === "string") return body.error;
      if (typeof body?.message === "string") return body.message;
    }
  } catch {
    // ignore JSON parsing issues
  }

  return error?.message || "Error al crear el presupuesto agrupado";
};

const fmtEUR = (n: any) => {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "0"));
  if (!Number.isFinite(num)) return "0,00 €";
  const parts = Math.abs(num).toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = num < 0 ? "-" : "";
  return `${sign}${intPart},${parts[1]} €`;
};

interface QuoteRow {
  id: string;
  quote_number: string;
  customer_id: string | null;
  status: string;
  final_price: number | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  quote_id: string;
  product_name: string | null;
  description: string | null;
  price: number | null;
  quantity: number | null;
  multi: any;
  grouped_into_quote_id: string | null;
}

export default function GroupedQuoteNew() {
  const navigate = useNavigate();
  const orgId = sessionStorage.getItem("selected_organization_id") || "";
  const [search, setSearch] = useState("");
  const [openQuotes, setOpenQuotes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Map<string, ItemRow & { source_quote_number: string }>>(new Map());
  const [customerId, setCustomerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Nuevo presupuesto agrupado | EasyQuote";
  }, []);

  const { data: quotes = [] } = useQuery({
    queryKey: ["grouped-source-quotes", orgId],
    queryFn: async () => {
      let q = supabase
        .from("quotes")
        .select("id, quote_number, customer_id, status, final_price, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (orgId) q = q.eq("organization_id", orgId);
      // Excluir presupuestos ya agrupados o anulados
      q = q.not("status", "in", "(grouped,cancelled,rejected)");
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as QuoteRow[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list-min", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name").order("name");
      return data || [];
    },
  });

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quotes.slice(0, 50);
    const customerMatchIds = new Set(
      customers.filter((c: any) => (c.name || "").toLowerCase().includes(term)).map((c: any) => c.id),
    );
    return quotes.filter(
      (q) =>
        (q.quote_number || "").toLowerCase().includes(term) ||
        (q.customer_id && customerMatchIds.has(q.customer_id)),
    );
  }, [quotes, customers, search]);

  const customerName = (id: string | null) => customers.find((c: any) => c.id === id)?.name || "—";

  const toggleQuoteOpen = (id: string) => {
    setOpenQuotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itemsByQuote = useQuoteItemsForOpen(orgId, openQuotes);

  const toggleItem = (item: ItemRow, quoteNumber: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, { ...item, source_quote_number: quoteNumber });
      // Precarga cliente si es el primero
      if (!customerId && next.size === 1) {
        const firstItem = next.values().next().value;
        if (firstItem) {
          const srcQuote = quotes.find((q) => q.id === firstItem.quote_id);
          if (srcQuote?.customer_id) setCustomerId(srcQuote.customer_id);
        }
      }
      return next;
    });
  };

  const total = useMemo(
    () => Array.from(selected.values()).reduce((s, it) => s + Number(it.price || 0), 0),
    [selected],
  );

  const handleCreate = async () => {
    if (!customerId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (selected.size === 0) {
      toast.error("Selecciona al menos un item");
      return;
    }
    if (!orgId) {
      toast.error("Falta la organización activa");
      return;
    }
    setSubmitting(true);
    try {
      const selections = Array.from(selected.values()).map((it) => ({
        source_quote_id: it.quote_id,
        source_item_id: it.id,
      }));
      const { data, error } = await supabase.functions.invoke("create-grouped-quote", {
        body: { customer_id: customerId, organization_id: orgId, selections, notes: notes || undefined },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      const newId = (data as any)?.quote_id;
      if (!newId) throw new Error("Respuesta inválida del servidor");
      toast.success(`Presupuesto agrupado creado: ${(data as any)?.quote_number}`);
      navigate(`/presupuestos/${newId}`);
    } catch (e: any) {
      toast.error(await getEdgeFunctionErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto p-2 md:p-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold">Nuevo presupuesto agrupado</h1>
        <Button variant="outline" size="sm" onClick={() => navigate("/presupuestos")}>
          Cancelar
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Columna izquierda: Origen */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Presupuestos origen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filteredQuotes.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">Sin resultados</p>
              )}
              {filteredQuotes.map((q) => {
                const isOpen = openQuotes.has(q.id);
                const items = itemsByQuote.get(q.id) || [];
                return (
                  <Collapsible key={q.id} open={isOpen} onOpenChange={() => toggleQuoteOpen(q.id)}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-2 rounded border hover:bg-accent text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                          <span className="font-medium text-sm">{q.quote_number}</span>
                          <span className="text-xs text-muted-foreground truncate">{customerName(q.customer_id)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtEUR(q.final_price)}</span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 pr-2 py-1 space-y-1">
                      {items.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">Sin items</p>
                      )}
                      {items.map((it) => {
                        const alreadyGrouped = !!it.grouped_into_quote_id;
                        const isMulti = it.multi && Array.isArray(it.multi.rows) && it.multi.rows.length > 1;
                        const isChecked = selected.has(it.id);
                        return (
                          <div
                            key={it.id}
                            className={`flex items-start gap-2 p-2 rounded border ${alreadyGrouped ? "opacity-50 bg-muted/30" : ""}`}
                          >
                            <Checkbox
                              checked={isChecked}
                              disabled={alreadyGrouped}
                              onCheckedChange={() => toggleItem(it, q.quote_number)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{it.product_name || "Item"}</p>
                              {it.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{it.description}</p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {alreadyGrouped && (
                                  <Badge variant="secondary" className="text-[10px]">Ya agrupado</Badge>
                                )}
                                {isMulti && !alreadyGrouped && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Multi-cantidad: se copiará la cantidad principal
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <span className="text-xs whitespace-nowrap">{fmtEUR(it.price)}</span>
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Columna derecha: Agrupado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Presupuesto agrupado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Items seleccionados ({selected.size})
              </p>
              <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                {selected.size === 0 ? (
                  <p className="text-sm text-muted-foreground p-2 border rounded text-center">
                    Aún no has añadido items
                  </p>
                ) : (
                  Array.from(selected.values()).map((it) => (
                    <div key={it.id} className="flex items-center justify-between p-2 rounded border text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{it.product_name || "Item"}</p>
                        <p className="text-xs text-muted-foreground">Origen: {it.source_quote_number}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="whitespace-nowrap">{fmtEUR(it.price)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => toggleItem(it, it.source_quote_number)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">{fmtEUR(total)}</span>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => navigate("/presupuestos")}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={submitting || selected.size === 0 || !customerId}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear agrupado
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function useQuoteItemsForOpen(_orgId: string, openQuotes: Set<string>) {
  const ids = useMemo(() => Array.from(openQuotes), [openQuotes]);
  const { data } = useQuery({
    queryKey: ["grouped-items-for", ids.sort().join(",")],
    queryFn: async () => {
      if (ids.length === 0) return [] as ItemRow[];
      const { data, error } = await supabase
        .from("quote_items")
        .select("id, quote_id, product_name, description, price, quantity, multi, grouped_into_quote_id")
        .in("quote_id", ids);
      if (error) throw error;
      return (data || []) as ItemRow[];
    },
    enabled: ids.length > 0,
  });
  const map = new Map<string, ItemRow[]>();
  (data || []).forEach((it) => {
    const arr = map.get(it.quote_id) || [];
    arr.push(it);
    map.set(it.quote_id, arr);
  });
  return map;
}