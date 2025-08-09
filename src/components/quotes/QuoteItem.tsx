import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import PromptsForm from "@/components/quotes/PromptsForm";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ItemSnapshot = {
  productId: string;
  prompts: Record<string, any>;
  outputs: any[];
  price?: any;
  multi?: any;
};

interface QuoteItemProps {
  hasToken: boolean;
  id: string | number;
  initialData?: ItemSnapshot;
  onChange?: (id: string | number, snapshot: ItemSnapshot) => void;
}

export default function QuoteItem({ hasToken, id, initialData, onChange }: QuoteItemProps) {
  // Local state per item
  const [productId, setProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [debouncedPromptValues, setDebouncedPromptValues] = useState<Record<string, any>>({});

  // Multi-cantidades
  const [multiEnabled, setMultiEnabled] = useState<boolean>(false);
  const [qtyPrompt, setQtyPrompt] = useState<string>("");
  const [qtyInputs, setQtyInputs] = useState<string[]>(["", "", "", "", ""]);
  const MAX_QTY = 10;
const [qtyCount, setQtyCount] = useState<number>(5);

// Inicialización desde datos previos (duplicar)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (!initialData) return;
    initializedRef.current = true;
    try {
      setProductId(initialData.productId || "");
      setPromptValues(initialData.prompts || {});
      const m: any = initialData.multi;
      if (m) {
        setMultiEnabled(true);
        if (m.qtyPrompt) setQtyPrompt(m.qtyPrompt);
        if (Array.isArray(m.qtyInputs)) {
          setQtyInputs(m.qtyInputs);
          setQtyCount(Math.max(1, Math.min(MAX_QTY, m.qtyInputs.length)));
        }
      }
    } catch {}
  }, [initialData]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPromptValues(promptValues), 350);
    return () => clearTimeout(t);
  }, [promptValues]);

  const fetchProducts = async (): Promise<any[]> => {
    const token = localStorage.getItem("easyquote_token");
    if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
    const { data, error } = await supabase.functions.invoke("easyquote-products", {
      body: { token },
    });
    if (error) throw error;
    const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
    return list as any[];
  };

  const getProductLabel = (p: any) =>
    p?.name ?? p?.title ?? p?.displayName ?? p?.productName ?? p?.product_name ?? p?.nombre ?? p?.Nombre ?? p?.description ?? "Producto sin nombre";

  const { data: products } = useQuery({
    queryKey: ["easyquote-products"],
    queryFn: fetchProducts,
    retry: 1,
    enabled: hasToken,
  });

  const { data: pricing, error: pricingError } = useQuery({
    queryKey: ["easyquote-pricing", productId, debouncedPromptValues],
    enabled: hasToken && !!productId,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: 5000,
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      const norm: Record<string, any> = {};
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        if (v === "" || v === undefined || v === null) return;
        if (typeof v === "string") {
          const trimmed = v.trim();
          const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
          if (isHex) {
            norm[k] = trimmed.slice(1).toUpperCase();
            return;
          }
          const num = Number(trimmed.replace(",", "."));
          if (!Number.isNaN(num) && /^-?\d+([.,]\d+)?$/.test(trimmed)) {
            norm[k] = num;
            return;
          }
          norm[k] = trimmed;
        } else {
          norm[k] = v;
        }
      });

      const baseUrl = `https://api.easyquote.cloud/api/v1/pricing/${productId}`;

      try {
        if (Object.keys(norm).length > 0) {
          const res = await fetch(baseUrl, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(Object.entries(norm).map(([id, value]) => ({ id, value }))),
          });
          if (!res.ok) throw new Error(`EasyQuote PATCH ${res.status}`);
          const json = await res.json();
          return json;
        } else {
          const res = await fetch(baseUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          if (!res.ok) throw new Error(`EasyQuote GET ${res.status}`);
          const json = await res.json();
          return json;
        }
      } catch (e) {
        const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
          body: { token, productId, inputs: Object.entries(norm).map(([id, value]) => ({ id, value })) },
        });
        if (error) throw error as any;
        return data;
      }
    },
  });

  // Reset prompts when product changes
  useEffect(() => {
    setPromptValues({});
  }, [productId]);

  // Derive prompts and outputs
  const outputs = useMemo(() => ((pricing as any)?.outputValues ?? []) as any[], [pricing]);
  const imageOutputs = useMemo(
    () => outputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? ""))),
    [outputs]
  );
  const priceOutput = useMemo(
    () => outputs.find((o: any) => String(o?.type || "").toLowerCase() === "price"),
    [outputs]
  );
  const otherOutputs = useMemo(
    () =>
      outputs.filter((o: any) => {
        const t = String(o?.type || "").toLowerCase();
        const n = String(o?.name || "").toLowerCase();
        const v = String(o?.value ?? "");
        const isImageLike = t.includes("image") || n.includes("image");
        const isNA = v === "" || v === "#N/A";
        return o !== priceOutput && !isImageLike && !isNA;
      }),
    [outputs, priceOutput]
  );

  const { data: multiResults, isFetching: multiLoading } = useQuery({
    queryKey: ["easyquote-multi", productId, debouncedPromptValues, qtyPrompt, qtyInputs, multiEnabled],
    enabled: hasToken && !!productId && multiEnabled && !!qtyPrompt && qtyInputs.some((q) => q && q.trim() !== ""),
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      const norm: Record<string, any> = {};
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        if (v === "" || v === undefined || v === null) return;
        if (typeof v === "string") {
          const trimmed = v.trim();
          const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
          if (isHex) {
            norm[k] = trimmed.slice(1).toUpperCase();
            return;
          }
          const num = Number(trimmed.replace(",", "."));
          if (!Number.isNaN(num) && /^-?\d+([.,]\d+)?$/.test(trimmed)) {
            norm[k] = num;
            return;
          }
          norm[k] = trimmed;
        } else {
          norm[k] = v;
        }
      });

      const qtys = qtyInputs
        .map((q) => Number(String(q).replace(/\./g, "").replace(",", ".")))
        .filter((n) => !Number.isNaN(n));
      if (qtys.length === 0) return [] as any[];
      const list = Object.entries(norm).map(([id, value]) => ({ id, value }));
      const results = await Promise.all(
        qtys.map(async (qty) => {
          const replaced = list.filter((it) => it.id !== qtyPrompt).concat([{ id: qtyPrompt, value: qty }]);
          const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
            body: { token, productId, inputs: replaced },
          });
          if (error) throw error as any;
          return { qty, data };
        })
      );
      return results;
    },
  });

  // Numeric prompts detection
  const numericPrompts = useMemo(() => {
    const p: any = pricing as any;
    const arr: any[] = Array.isArray(p?.prompts) ? p.prompts : [];
    return arr
      .filter((sp: any) => {
        const hasOptions = Array.isArray(sp?.valueOptions) && sp.valueOptions.length > 0;
        if (hasOptions) return false;
        const t = String(sp?.promptType || "").toLowerCase();
        if (t.includes("number")) return true;
        const cv = sp?.currentValue ?? sp?.default ?? sp?.value;
        return typeof cv === "number";
      })
      .map((sp: any) => ({ id: String(sp.id), label: sp.promptText ?? sp.name ?? sp.id }));
  }, [pricing]);

  useEffect(() => {
    if (!qtyPrompt && numericPrompts.length > 0) setQtyPrompt(numericPrompts[0].id);
  }, [numericPrompts, qtyPrompt]);

  // Sync first quantity with form value
  useEffect(() => {
    if (!multiEnabled || !qtyPrompt) return;
    const current = (promptValues as any)[qtyPrompt];
    if (current !== undefined && current !== null && String(current) !== "") {
      setQtyInputs((prev) => {
        const asStr = String(current);
        if (String(prev[0] ?? "") === asStr) return prev;
        const next = [...prev];
        next[0] = asStr;
        return next;
      });
    }
  }, [promptValues, qtyPrompt, multiEnabled]);

  // Adjust qty inputs length
  useEffect(() => {
    setQtyInputs((prev) => {
      if (qtyCount > prev.length) return prev.concat(Array(qtyCount - prev.length).fill(""));
      if (qtyCount < prev.length) return prev.slice(0, qtyCount);
      return prev;
    });
  }, [qtyCount]);

  const formatEUR = (val: any) => {
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) return `${String(val)} €`;
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const multiRows = useMemo(() => {
    const rows = (multiResults as any[] | undefined) || [];
    return rows.map((r: any) => {
      const outs: any[] = Array.isArray(r?.data?.outputValues) ? r.data.outputValues : [];
      const priceOut = outs.find(
        (o: any) => String(o?.type || "").toLowerCase() === "price" || String(o?.name || "").toLowerCase().includes("precio") || String(o?.name || "").toLowerCase().includes("price")
      );
      const totalStr = priceOut?.value ?? "";
      const totalNum = typeof totalStr === "number" ? totalStr : parseFloat(String(totalStr).replace(/\./g, "").replace(",", "."));
      const unit = r.qty > 0 && !Number.isNaN(totalNum) ? totalNum / r.qty : NaN;
      return { qty: r.qty, outs, totalStr, unit };
    });
  }, [multiResults]);

  useEffect(() => {
    onChange?.(id, {
      productId,
      prompts: promptValues,
      outputs,
      price: (priceOutput as any)?.value ?? null,
      multi: multiEnabled ? { qtyPrompt, qtyInputs, rows: multiRows } : null,
    });
  }, [id, onChange, productId, promptValues, outputs, priceOutput, multiEnabled, qtyPrompt, qtyInputs, multiRows]);

  const handlePromptChange = (id: string, value: any) => setPromptValues((prev) => ({ ...prev, [id]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artículo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Producto</Label>
          <Select onValueChange={setProductId} value={productId} disabled={!hasToken}>
            <SelectTrigger>
              <SelectValue placeholder={hasToken ? "Elige un producto" : "Conecta EasyQuote para cargar"} />
            </SelectTrigger>
            <SelectContent>
              {products?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{getProductLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {productId ? (
          <div className="grid gap-6 md:grid-cols-5">
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Opciones</CardTitle>
              </CardHeader>
              <CardContent>
                {pricing ? (
                  <PromptsForm product={pricing} values={promptValues} onChange={handlePromptChange} />
                ) : (
                  <p className="text-sm text-muted-foreground">Cargando prompts…</p>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-2 md:sticky md:top-6 self-start space-y-3">
              {imageOutputs.length > 0 && (
                <section className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  {imageOutputs.map((o: any, idx: number) => (
                    <img key={idx} src={String(o.value)} alt={`resultado imagen ${idx + 1}`} loading="lazy" className="w-full h-auto rounded-md" />
                  ))}
                </section>
              )}

              <Card className="border-accent/50 bg-muted/50">
                <CardHeader>
                  <CardTitle>Resultado</CardTitle>
                </CardHeader>
                <CardContent>
                  {pricingError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTitle>Producto sin pricing</AlertTitle>
                      <AlertDescription>El producto seleccionado no existe o es incorrecto.</AlertDescription>
                    </Alert>
                  )}

                  {priceOutput ? (
                    <div className="p-4 rounded-md border bg-card/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Precio</span>
                        <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-lg font-semibold">
                          {formatEUR((priceOutput as any).value)}
                        </span>
                      </div>
                    </div>
                  ) : (!pricingError && <p className="text-sm text-muted-foreground">Selecciona opciones para ver el resultado.</p>)}

                  {otherOutputs.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <section className="space-y-2">
                        {otherOutputs.map((o: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{o.name ?? "Resultado"}</span>
                            <span>{String(o.value)}</span>
                          </div>
                        ))}
                      </section>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-accent/50 bg-muted/30">
                <CardHeader>
                  <CardTitle>Múltiples cantidades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Activar</Label>
                    </div>
                    <Switch checked={multiEnabled} onCheckedChange={setMultiEnabled} />
                  </div>

                  {multiEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label>Prompt de cantidad</Label>
                        <Select value={qtyPrompt} onValueChange={setQtyPrompt} disabled={numericPrompts.length === 0}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona prompt numérico" />
                          </SelectTrigger>
                          <SelectContent>
                            {numericPrompts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>¿Cuántos?</Label>
                        <Input
                          type="number"
                          min={1}
                          max={MAX_QTY}
                          value={qtyCount}
                          onChange={(e) => {
                            const n = parseInt(e.target.value || "0", 10);
                            if (Number.isNaN(n)) return;
                            setQtyCount(Math.max(1, Math.min(MAX_QTY, n)));
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: qtyCount }, (_, i) => (
                          <div key={i} className="space-y-1">
                            <Label>Q{i + 1}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={qtyInputs[i] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setQtyInputs((prev) => {
                                  const next = [...prev];
                                  next[i] = v;
                                  return next;
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      <Separator className="my-2" />
                      {multiLoading ? (
                        <p className="text-sm text-muted-foreground">Calculando...</p>
                      ) : (Array.isArray(multiRows) && multiRows.length > 0 ? (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {multiRows.map((_, idx) => (
                                  <TableHead key={idx}>Q{idx + 1}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                {multiRows.map((r, idx) => {
                                  const priceOut = (r.outs || []).find((o:any)=> String(o?.type||'').toLowerCase()==='price' || String(o?.name||'').toLowerCase().includes('precio') || String(o?.name||'').toLowerCase().includes('price'));
                                  return (
                                    <TableCell key={idx}>{formatEUR(priceOut?.value)}</TableCell>
                                  );
                                })}
                              </TableRow>
                            </TableBody>
                          </Table>

                          <div className="mt-3">
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="detalles">
                                <AccordionTrigger>Detalles</AccordionTrigger>
                                <AccordionContent>
                                  <Tabs defaultValue="q1" className="w-full">
                                    <TabsList className="mb-3">
                                      {multiRows.map((_, idx) => (
                                        <TabsTrigger key={idx} value={`q${idx + 1}`}>Q{idx + 1}</TabsTrigger>
                                      ))}
                                    </TabsList>

                                    {multiRows.map((r, idx) => {
                                      const outs = r.outs || [];
                                      const priceOut = outs.find((o:any)=> String(o?.type||'').toLowerCase()==='price' || String(o?.name||'').toLowerCase().includes('precio') || String(o?.name||'').toLowerCase().includes('price'));
                                      const details = outs.filter((o:any) => {
                                        const t = String(o?.type || '').toLowerCase();
                                        const n = String(o?.name || '').toLowerCase();
                                        const v = String(o?.value ?? '');
                                        const isImageLike = t.includes('image') || n.includes('image');
                                        const isNA = v === '' || v === '#N/A';
                                        return o !== priceOut && !isImageLike && !isNA;
                                      });
                                      return (
                                        <TabsContent key={idx} value={`q${idx + 1}`}>
                                          <div className="p-3 rounded-md border bg-card/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-muted-foreground">Precio total</span>
                                              <span className="font-semibold">{formatEUR(priceOut?.value)}</span>
                                            </div>
                                            {details.length > 0 && (
                                              <>
                                                <Separator className="my-2" />
                                                <div className="space-y-1">
                                                  {details.map((o:any, i:number) => (
                                                    <div key={i} className="flex items-center justify-between text-sm">
                                                      <span className="text-muted-foreground">{o.name ?? 'Dato'}</span>
                                                      <span>{String(o.value)}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </TabsContent>
                                      );
                                    })}
                                  </Tabs>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Añade cantidades para ver precios.</p>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Selecciona un producto para configurar este artículo.</p>
        )}
      </CardContent>
    </Card>
  );
}
