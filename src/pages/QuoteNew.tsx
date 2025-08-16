import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PromptsForm from "@/components/quotes/PromptsForm";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuoteItem from "@/components/quotes/QuoteItem";
import { PDFDownloadLink } from "@react-pdf/renderer";
import QuotePDF from "@/components/quotes/QuotePDF";
import { useLocation, useSearchParams } from "react-router-dom";


interface Customer { id: string; name: string }
interface Product { id: string; name?: string; title?: string }

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Customer[];
};

const fetchProducts = async (): Promise<Product[]> => {
  const token = localStorage.getItem("easyquote_token");
  if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
  const { data, error } = await supabase.functions.invoke("easyquote-products", {
    body: { token },
  });
  if (error) throw error;
  const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
  return list as Product[];
};

const getProductLabel = (p: any) =>
  p?.name ??
  p?.title ??
  p?.displayName ??
  p?.productName ??
  p?.product_name ??
  p?.nombre ??
  p?.Nombre ??
  p?.description ??
  "Producto sin nombre";

const QuoteNew = () => {
  const [customerId, setCustomerId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("easyquote_token"));
  const [eqEmail, setEqEmail] = useState<string>("");
  const [eqPassword, setEqPassword] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const queryClient = useQueryClient();
  

  // Artículos adicionales en el presupuesto
  const [extraItems, setExtraItems] = useState<number[]>([]);
  const [extraItemsData, setExtraItemsData] = useState<Record<number, any>>({});
  const addItem = () => setExtraItems((prev) => [...prev, Date.now()]);

  // Budget additionals
  const [budgetAdditionals, setBudgetAdditionals] = useState<Record<string, { enabled: boolean; value: number }>>({});

  // Duplicar desde presupuesto previo
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromState = (location.state as any)?.fromQuoteId;
  const fromParam = searchParams.get("from");
  const fromQuoteId = fromState || fromParam || null;
  const [prefillDone, setPrefillDone] = useState(false);
  const [initialItems, setInitialItems] = useState<Record<number, any>>({});

  useEffect(() => {
    if (!fromQuoteId || prefillDone) return;
    (async () => {
      try {
        const { data: q, error: qe } = await supabase
          .from("quotes")
          .select("id, customer_id, description")
          .eq("id", fromQuoteId)
          .maybeSingle();
        if (qe) throw qe;
        if (q) {
          setCustomerId(q.customer_id);
          setDescription((q as any).description || "");
          const { data: items, error: ie } = await supabase
            .from("quote_items")
            .select("product_id, prompts, outputs, multi, total_price, position, name")
            .eq("quote_id", q.id)
            .order("position", { ascending: true });
          if (ie) throw ie;
          const keys: number[] = [];
          const initMap: Record<number, any> = {};
          (items || []).forEach((it: any, idx: number) => {
            const key = Date.now() + idx;
            keys.push(key);
            initMap[key] = {
              productId: it.product_id || "",
              prompts: it.prompts || {},
              outputs: it.outputs || [],
              price: it.total_price || null,
              multi: it.multi || null,
              itemDescription: it.name || "",
              needsRecalculation: true, // Marcar para recálculo
            };
          });
          if (keys.length) {
            setExtraItems(keys);
          }
          setInitialItems(initMap);
          toast({ title: "Datos cargados", description: "Presupuesto cargado." });
        }
        setPrefillDone(true);
      } catch (e: any) {
        toast({ title: "No se pudo cargar el presupuesto", description: e?.message || "Inténtalo de nuevo", variant: "destructive" });
      }
    })();
  }, [fromQuoteId, prefillDone]);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  
  const { data: additionals } = useQuery({
    queryKey: ["additionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    document.title = "Nuevo Presupuesto | Productos y Cliente";
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEqEmail(data.user?.email ?? ""));
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("easyquote-auth", {
        body: { email: eqEmail, password: eqPassword },
      });
      if (error) throw error as any;
      if ((data as any)?.token) {
        localStorage.setItem("easyquote_token", (data as any).token);
        setHasToken(true);
        toast({ title: "Conectado con EasyQuote" });
        await queryClient.invalidateQueries({ queryKey: ["easyquote-products"] });
      } else {
        throw new Error("Respuesta sin token");
      }
    } catch (err: any) {
      toast({ title: "No se pudo conectar", description: err?.message || "Verifica credenciales", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <main className="space-y-6">
      <header className="sr-only">
        <h1>Nuevo presupuesto - seleccionar cliente y producto</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos/nuevo`} />
        <meta name="description" content="Crear presupuesto: selecciona cliente y producto para ver prompts y resultados." />
      </header>

      {/* Cabecera fija siempre visible */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4 mb-6">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Nuevo Presupuesto</span>
                <Button onClick={addItem} disabled={!customerId}>
                  Agregar artículo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select onValueChange={setCustomerId} value={customerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descripción del presupuesto</Label>
                  <Input 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe brevemente este presupuesto..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="px-6 space-y-6">

      {!hasToken && (
        <Card>
          <CardHeader>
            <CardTitle>Conectar EasyQuote</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <Label>Email</Label>
                <Input value={eqEmail} onChange={(e) => setEqEmail(e.target.value)} type="email" required />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Contraseña</Label>
                <Input value={eqPassword} onChange={(e) => setEqPassword(e.target.value)} type="password" required />
              </div>
              <div className="flex items-end md:col-span-1">
                <Button type="submit" disabled={connecting} className="w-full">{connecting ? "Conectando..." : "Conectar"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Artículos adicionales */}
      {customerId && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Artículos</h2>

          {extraItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay artículos añadidos.</p>
              <p className="text-sm">Usa el botón "Agregar artículo" en la cabecera para empezar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {extraItems.map((k) => (
                <QuoteItem
                  key={k}
                  id={k}
                  hasToken={hasToken}
                  initialData={initialItems[k]}
                  onChange={(id, data) => setExtraItemsData((prev) => ({ ...prev, [id as number]: data }))}
                  onRemove={(id) => {
                    setExtraItems((prev) => prev.filter((item) => item !== id));
                    setExtraItemsData((prev) => {
                      const { [id as number]: removed, ...rest } = prev;
                      return rest;
                    });
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Budget Additionals */}
      {customerId && extraItems.length > 0 && additionals && additionals.length > 0 && (
        <section className="space-y-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="budget-additionals">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span>Adicionales del presupuesto</span>
                  {Object.values(budgetAdditionals).some(a => a.enabled) && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {Object.values(budgetAdditionals).filter(a => a.enabled).length} activos
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {additionals.map((additional) => {
                    const config = budgetAdditionals[additional.id] || { enabled: false, value: additional.default_value };
                    return (
                      <div key={additional.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`budget-additional-${additional.id}`}
                              checked={config.enabled}
                              onChange={(e) => {
                                setBudgetAdditionals(prev => ({
                                  ...prev,
                                  [additional.id]: {
                                    ...config,
                                    enabled: e.target.checked
                                  }
                                }));
                              }}
                              className="rounded border-gray-300"
                            />
                            <div>
                              <label 
                                htmlFor={`budget-additional-${additional.id}`}
                                className="text-sm font-medium"
                              >
                                {additional.name}
                              </label>
                              {additional.description && (
                                <p className="text-xs text-muted-foreground mt-1">{additional.description}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Importe neto
                          </span>
                        </div>
                        
                        {config.enabled && (
                          <div className="space-y-2">
                            <Label htmlFor={`budget-value-${additional.id}`}>Valor</Label>
                            <Input
                              id={`budget-value-${additional.id}`}
                              type="number"
                              step="0.01"
                              value={config.value}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setBudgetAdditionals(prev => ({
                                  ...prev,
                                  [additional.id]: {
                                    ...config,
                                    value
                                  }
                                }));
                              }}
                              placeholder={`Valor por defecto: ${additional.default_value}`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      )}

      {(() => {
        const hasAnyItems = extraItems.length > 0;
        
        if (!hasAnyItems) return null;
        
        return (
          <section className="flex items-center justify-end gap-3 pt-4">
            <Button onClick={async () => {
              try {
                const parseNumber = (v: any) => {
                  if (typeof v === "number") return v;
                  const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
                  return Number.isNaN(n) ? 0 : n;
                };
                const extrasTotal = Object.values(extraItemsData || {}).reduce((acc: number, it: any) => acc + parseNumber(it?.price), 0);
                
                // Calculate budget additionals total
                const budgetAdditionalsTotal = Object.entries(budgetAdditionals).reduce((acc, [id, config]) => {
                  if (!config.enabled) return acc;
                  return acc + config.value;
                }, 0);
                
                const finalTotal = extrasTotal + budgetAdditionalsTotal;

                const quoteNumber = `P-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;

                const { data: inserted, error } = await supabase
                  .from("quotes")
                  .insert([{ 
                    quote_number: quoteNumber,
                    status: "draft",
                    customer_id: customerId,
                    product_name: null,
                    description: description.trim() || null,
                    selections: {},
                    results: [],
                    final_price: finalTotal,
                    quote_additionals: budgetAdditionals
                  }])
                  .select("id")
                  .maybeSingle();

                if (error) throw error;
                const quoteId = inserted?.id;
                if (!quoteId) throw new Error("No se pudo crear el presupuesto.");

                const items = Object.entries(extraItemsData || {}).map(([k, data]: any, index) => ({
                  quote_id: quoteId,
                  name: data?.itemDescription || `Artículo ${index + 1}`,
                  product_id: data?.productId ?? null,
                  prompts: data?.prompts ?? {},
                  outputs: data?.outputs ?? [],
                  multi: data?.multi ?? null,
                  total_price: parseNumber(data?.price) || null,
                  position: index,
                  item_additionals: data?.itemAdditionals ?? {}
                }));

                if (items.length > 0) {
                  const { error: itemsErr } = await supabase.from("quote_items").insert(items);
                  if (itemsErr) throw itemsErr;
                }

                toast({ title: "Presupuesto guardado", description: "Se ha guardado como borrador." });
              } catch (e: any) {
                toast({ title: "Error al guardar", description: e?.message || "Revisa los datos e inténtalo de nuevo.", variant: "destructive" });
              }
            }}>Guardar presupuesto</Button>

            <PDFDownloadLink
              document={
                <QuotePDF
                  customer={(customers || []).find((c) => c.id === customerId)}
                  main={null}
                  items={Object.values(extraItemsData || {}).map((data: any, index: number) => ({
                    name: data?.itemDescription || `Artículo ${index + 1}`,
                    description: data?.itemDescription || "",
                    prompts: data?.prompts || {},
                    outputs: data?.outputs || [],
                    total_price: data?.price || 0
                  }))}
                  template={{
                    companyName: localStorage.getItem("pdf_template_config") ? 
                      JSON.parse(localStorage.getItem("pdf_template_config") || "{}").companyName || "" : "",
                    logoUrl: localStorage.getItem("pdf_template_config") ? 
                      JSON.parse(localStorage.getItem("pdf_template_config") || "{}").logoUrl || "" : "",
                    brandColor: localStorage.getItem("pdf_template_config") ? 
                      JSON.parse(localStorage.getItem("pdf_template_config") || "{}").brandColor || "#0ea5e9" : "#0ea5e9",
                    footerText: localStorage.getItem("pdf_template_config") ? 
                      JSON.parse(localStorage.getItem("pdf_template_config") || "{}").footerText || "" : ""
                  }}
                  quote={null}
                />
              }
              fileName={`presupuesto-nuevo-${Date.now()}.pdf`}
            >
              {({ loading }) => (
                <Button variant="secondary" disabled={loading}>
                  {loading ? "Generando..." : "Generar PDF"}
                </Button>
              )}
            </PDFDownloadLink>
          </section>
        );
      })()}

      </div>
    </main>
  );
};

export default QuoteNew;
