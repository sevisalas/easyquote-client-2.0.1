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
  const [productId, setProductId] = useState<string>("");
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("easyquote_token"));
  const [eqEmail, setEqEmail] = useState<string>("");
  const [eqPassword, setEqPassword] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const queryClient = useQueryClient();
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [debouncedPromptValues, setDebouncedPromptValues] = useState<Record<string, any>>({});
  // Multi-cantidades
  const [multiEnabled, setMultiEnabled] = useState<boolean>(false);
  const [qtyPrompt, setQtyPrompt] = useState<string>("");
  const [qtyInputs, setQtyInputs] = useState<string[]>(["100", "200", "500"]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPromptValues(promptValues), 350);
    return () => clearTimeout(t);
  }, [promptValues]);

  useEffect(() => {
    document.title = "Nuevo Presupuesto | Productos y Cliente";
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEqEmail(data.user?.email ?? ""));
  }, []);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const { data: products } = useQuery({ queryKey: ["easyquote-products"], queryFn: fetchProducts, retry: 1, enabled: hasToken });
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

        // Normalizar inputs para la API (quitar '#' en colores hex y forzar números)
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
          // PATCH para actualizar (si hay inputs), GET solo para carga inicial
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

  useEffect(() => {
    if (pricing) {
      try {
        // Debug: inspect pricing structure to support dynamic prompts
        // eslint-disable-next-line no-console
        console.log("[pricing] keys", Object.keys(pricing as any));
        // eslint-disable-next-line no-console
        console.log("[pricing] sample", (pricing as any));
      } catch {}
    }
  }, [pricing]);

  const selectedProduct = useMemo(() => products?.find((p: any) => String(p.id) === String(productId)), [products, productId]);
  const canShowPanels = useMemo(() => !!customerId && !!productId, [customerId, productId]);
  const handlePromptChange = (id: string, value: any) => {
    setPromptValues((prev) => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    // Reset prompts when product changes
    setPromptValues({});
  }, [productId]);

  useEffect(() => {
    const p: any = pricing as any;
    const serverPrompts: any[] = Array.isArray(p?.prompts) ? p.prompts : [];
    if (!serverPrompts.length) return;
    setPromptValues((prev) => {
      const next: Record<string, any> = { ...prev };
      let changed = false;

      const serverIds = new Set<string>(serverPrompts.map((sp: any) => String(sp.id)));
      // Remove keys that no longer exist
      Object.keys(next).forEach((k) => {
        if (!serverIds.has(String(k))) {
          delete next[k];
          changed = true;
        }
      });

      // Sincronizar con servidor sin pisar lo que el usuario está escribiendo
      for (const sp of serverPrompts) {
        const id = String(sp.id);
        const options: string[] = (sp.valueOptions ?? []).map((v: any) => String(v?.value ?? v));
        const currentValue = sp.currentValue ?? sp.value ?? sp.default ?? undefined;
        const hasOptions = options.length > 0;
        const val = next[id];
        const valStr = val !== undefined && val !== null ? String(val) : undefined;

        if (hasOptions) {
          const isValid = valStr !== undefined && options.includes(valStr);
          if (valStr === undefined || !isValid) {
            if (currentValue !== undefined) {
              next[id] = currentValue;
              changed = true;
            } else if (options.length) {
              next[id] = options[0];
              changed = true;
            }
          }
        } else {
          // Entrada libre (sin opciones): solo inicializar si está vacío
          if (valStr === undefined && currentValue !== undefined) {
            next[id] = currentValue;
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [pricing]);

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
    if (!qtyPrompt && numericPrompts.length > 0) {
      setQtyPrompt(numericPrompts[0].id);
    }
  }, [numericPrompts, qtyPrompt]);

  // Sincroniza la primera cantidad con el valor actual del formulario
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

  const qtyLabel = useMemo(() => {
    const found = numericPrompts.find((p) => p.id === qtyPrompt);
    return found?.label ?? "Cantidad";
  }, [numericPrompts, qtyPrompt]);

  const formatEUR = (val: any) => {
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) return `${String(val)} €`;
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const outputs = useMemo(() => ((pricing as any)?.outputValues ?? []) as any[], [pricing]);
  const imageOutputs = useMemo(
    () =>
      outputs.filter((o: any) => {
        const v = String(o?.value ?? "");
        return /^https?:\/\//i.test(v);
      }),
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
        return o !== priceOutput && !imageOutputs.includes(o) && !isImageLike && !isNA;
      }),
    [outputs, priceOutput, imageOutputs]
  );

  const { data: multiResults, isFetching: multiLoading } = useQuery({
    queryKey: ["easyquote-multi", productId, debouncedPromptValues, qtyPrompt, qtyInputs, multiEnabled],
    enabled: hasToken && !!productId && multiEnabled && !!qtyPrompt && qtyInputs.some((q) => q && q.trim() !== ""),
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      // Normalizar inputs base
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
        .filter((n) => !Number.isNaN(n))
        .slice(0, 1);

      if (qtys.length === 0) return [] as any[];

      const qty = qtys[0];
      const list = Object.entries(norm).map(([id, value]) => ({ id, value }));
      const replaced = list.filter((it) => it.id !== qtyPrompt).concat([{ id: qtyPrompt, value: qty }]);
      const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
        body: { token, productId, inputs: replaced },
      });
      if (error) throw error as any;
      return [{ qty, data }];
    },
  });

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
    <main className="p-6 space-y-6">
      <header className="sr-only">
        <h1>Nuevo presupuesto - seleccionar cliente y producto</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos/nuevo`} />
        <meta name="description" content="Crear presupuesto: selecciona cliente y producto para ver prompts y resultados." />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Selecciona cliente y producto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
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
        </CardContent>
      </Card>

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

      {canShowPanels && (
        <> 
          <div className="grid gap-6 md:grid-cols-5">
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Opciones</CardTitle>
              </CardHeader>
              <CardContent>
                {pricing || selectedProduct ? (
                  <PromptsForm product={pricing || selectedProduct} values={promptValues} onChange={handlePromptChange} />
                ) : (
                  <p className="text-sm text-muted-foreground">Selecciona un producto para ver sus opciones.</p>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-2 md:sticky md:top-6 self-start space-y-3">
              {imageOutputs.length > 0 && (
                <section className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                  {imageOutputs.map((o: any, idx: number) => (
                    <img
                      key={idx}
                      src={String(o.value)}
                      alt={`resultado imagen ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-auto rounded-md"
                    />
                  ))}
                </section>
              )}

              <Card className="border-accent/50 bg-muted/50 animate-fade-in">
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
                        <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-lg font-semibold hover-scale">
                          {formatEUR((priceOutput as any).value)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    !pricingError && (
                      <p className="text-sm text-muted-foreground">Selecciona opciones para ver el resultado.</p>
                    )
                  )}

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

                      <div className="grid grid-cols-5 gap-2">
                        {[0,1,2,3,4].map((i) => (
                          <div key={i} className="space-y-1">
                            <Label>{qtyLabel} {i+1}</Label>
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
                      ) : (multiRows && multiRows.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{qtyLabel}</TableHead>
                              <TableHead>Precio total</TableHead>
                              <TableHead>Detalles</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {multiRows.map((r, idx) => {
                              const priceOut = (r.outs || []).find((o:any)=> String(o?.type||'').toLowerCase()==='price' || String(o?.name||'').toLowerCase().includes('precio') || String(o?.name||'').toLowerCase().includes('price'));
                              const other = (r.outs || []).filter((o:any) => {
                                const t = String(o?.type || '').toLowerCase();
                                const n = String(o?.name || '').toLowerCase();
                                const v = String(o?.value ?? '');
                                const isImageLike = t.includes('image') || n.includes('image');
                                const isNA = v === '' || v === '#N/A';
                                return o !== priceOut && !isImageLike && !isNA;
                              });
                              const isOpen = !!expandedRows[idx];
                              return (
                                <>
                                  <TableRow key={`row-${idx}`}>
                                    <TableCell>{r.qty}</TableCell>
                                    <TableCell>{formatEUR(priceOut?.value)}</TableCell>
                                    <TableCell>
                                      {other.length > 0 && (
                                        <Button variant="outline" size="sm" onClick={() => setExpandedRows((prev) => ({ ...prev, [idx]: !prev[idx] }))}>
                                          {isOpen ? "Ocultar" : "Ver más"}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  {isOpen && (
                                    <TableRow key={`detail-${idx}`}>
                                      <TableCell colSpan={3}>
                                        <div className="space-y-1">
                                          {other.map((o:any, i:number) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                              <span className="text-muted-foreground">{o.name ?? 'Resultado'}</span>
                                              <span>{String(o.value)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">Añade cantidades para ver precios.</p>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default QuoteNew;
