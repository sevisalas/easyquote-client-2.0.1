import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import QuotePdfTemplateDialog from "@/components/quotes/QuotePdfTemplateDialog";

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

const fetchQuote = async (id: string) => {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, customer_id, description, status, quote_additionals")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const fetchItems = async (quoteId: string) => {
  const { data, error } = await supabase
    .from("quote_items")
    .select("id, name, product_id, prompts, outputs, multi, total_price, position, item_additionals")
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data || [];
};

const QuoteEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("easyquote_token"));
  const [pdfOpen, setPdfOpen] = useState(false);

  // Artículos adicionales en el presupuesto
  const [extraItems, setExtraItems] = useState<number[]>([]);
  const [extraItemsData, setExtraItemsData] = useState<Record<number, any>>({});
  const addItem = () => setExtraItems((prev) => [...prev, Date.now()]);

  // Budget additionals
  const [budgetAdditionals, setBudgetAdditionals] = useState<Record<string, { enabled: boolean; value: number }>>({});

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
  const { data: quote } = useQuery({ 
    queryKey: ["quote", id], 
    queryFn: () => fetchQuote(id!), 
    enabled: !!id 
  });
  const { data: items = [] } = useQuery({ 
    queryKey: ["quote-items", id], 
    queryFn: () => fetchItems(id!), 
    enabled: !!id 
  });

  useEffect(() => {
    document.title = "Editar Presupuesto | Productos y Cliente";
  }, []);

  useEffect(() => {
    if (quote) {
      if (quote.status !== 'draft') {
        toast({ 
          title: "Presupuesto no editable", 
          description: "Solo se pueden editar presupuestos en estado borrador",
          variant: "destructive" 
        });
        navigate(`/presupuestos/${id}`);
        return;
      }
      setCustomerId(quote.customer_id);
      setDescription(quote.description || "");
      setBudgetAdditionals((quote.quote_additionals as Record<string, { enabled: boolean; value: number }>) || {});
    }
  }, [quote, id, navigate]);

  useEffect(() => {
    if (items.length > 0) {
      const keys: number[] = [];
      const itemsMap: Record<number, any> = {};
      
      items.forEach((item: any, idx: number) => {
        const key = Date.now() + idx;
        keys.push(key);
        itemsMap[key] = {
          productId: item.product_id || "",
          prompts: item.prompts || {},
          outputs: item.outputs || [],
          price: item.total_price || null,
          multi: item.multi || null,
          itemDescription: item.name || "",
          itemId: item.id, // Para poder actualizarlo
          itemAdditionals: item.item_additionals || {},
        };
      });
      
      setExtraItems(keys);
      setExtraItemsData(itemsMap);
    }
  }, [items]);

  return (
    <main className="space-y-6">
      <header className="sr-only">
        <h1>Editar presupuesto - modificar cliente y producto</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos/editar/${id}`} />
        <meta name="description" content="Editar presupuesto: modificar cliente y producto para actualizar prompts y resultados." />
      </header>

      {/* Cabecera fija siempre visible */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4 mb-6">
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Editar Presupuesto</span>
                <div className="flex gap-2">
                  <Button onClick={addItem} disabled={!customerId}>
                    Agregar artículo
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/presupuestos/${id}`)}>
                    Cancelar
                  </Button>
                </div>
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
                    initialData={extraItemsData[k]}
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

                  // Actualizar presupuesto
                  const { error: quoteError } = await supabase
                    .from("quotes")
                    .update({ 
                      customer_id: customerId,
                      description: description.trim() || null,
                      final_price: finalTotal,
                      quote_additionals: budgetAdditionals
                    })
                    .eq("id", id);

                  if (quoteError) throw quoteError;

                  // Eliminar artículos existentes
                  const { error: deleteError } = await supabase
                    .from("quote_items")
                    .delete()
                    .eq("quote_id", id);

                  if (deleteError) throw deleteError;

                  // Insertar artículos actualizados
                  const newItems = Object.entries(extraItemsData || {}).map(([k, data]: any, index) => ({
                    quote_id: id,
                    name: data?.itemDescription || `Artículo ${index + 1}`,
                    product_id: data?.productId ?? null,
                    prompts: data?.prompts ?? {},
                    outputs: data?.outputs ?? [],
                    multi: data?.multi ?? null,
                    total_price: parseNumber(data?.price) || null,
                    position: index,
                    item_additionals: data?.itemAdditionals ?? {}
                  }));

                  if (newItems.length > 0) {
                    const { error: itemsErr } = await supabase.from("quote_items").insert(newItems);
                    if (itemsErr) throw itemsErr;
                  }

                  toast({ title: "Presupuesto actualizado", description: "Los cambios se han guardado correctamente." });
                  navigate(`/presupuestos/${id}`);
                } catch (e: any) {
                  toast({ title: "Error al actualizar", description: e?.message || "Revisa los datos e inténtalo de nuevo.", variant: "destructive" });
                }
              }}>Guardar cambios</Button>

              <Button variant="secondary" onClick={() => setPdfOpen(true)}>Generar PDF</Button>
            </section>
          );
        })()}

        <QuotePdfTemplateDialog
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          customer={(customers || []).find((c) => c.id === customerId)}
          main={null}
          items={items || []}
          quote={quote}
        />
      </div>
    </main>
  );
};

export default QuoteEdit;