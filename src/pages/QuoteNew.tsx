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
  const [description, setDescription] = useState<string>("");
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
  const [qtyInputs, setQtyInputs] = useState<string[]>(["", "", "", "", ""]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const MAX_QTY = 10; // TODO: Configurable desde Settings
  const [qtyCount, setQtyCount] = useState<number>(5);
  const [pdfOpen, setPdfOpen] = useState(false);
  // Duplicación desde presupuesto previo
  const [dupProductName, setDupProductName] = useState<string | null>(null);
  const [dupResults, setDupResults] = useState<any[]>([]);

  // Artículos adicionales en el presupuesto
  const [extraItems, setExtraItems] = useState<number[]>([]);
  const [extraItemsData, setExtraItemsData] = useState<Record<number, any>>({});
const addItem = () => setExtraItems((prev) => [...prev, Date.now()]);

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
          .select("id, customer_id, selections, results, product_name, description")
          .eq("id", fromQuoteId)
          .maybeSingle();
        if (qe) throw qe;
        if (q) {
          setCustomerId(q.customer_id);
          setDupProductName((q as any).product_name || null);
          setDescription((q as any).description || "");
          setPromptValues((q as any).selections || {});
          setDupResults(((q as any).results as any[]) || []);
          const { data: items, error: ie } = await supabase
            .from("quote_items")
            .select("product_id, prompts, outputs, multi, total_price, position")
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
            };
          });
          if (keys.length) setExtraItems(keys);
          setInitialItems(initMap);
          toast({ title: "Datos cargados", description: "Usando presupuesto previo como base." });
        }
      } catch (e: any) {
        toast({ title: "No se pudo cargar el presupuesto", description: e?.message || "Inténtalo de nuevo", variant: "destructive" });
      }
    })();
  }, [fromQuoteId, prefillDone]);

  // Cargar productos (antes de usarlos en el prefill)
  const { data: products } = useQuery({ queryKey: ["easyquote-products"], queryFn: fetchProducts, retry: 1, enabled: hasToken });

  // Seleccionar automáticamente el producto según el nombre del presupuesto duplicado
  useEffect(() => {
    if (!fromQuoteId || prefillDone) return;
    if (!dupProductName) return;
    if (!Array.isArray(products) || products.length === 0) return;

    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
    const target = norm(String(dupProductName));

    const exact = (products as any[]).find((p: any) => norm(getProductLabel(p)) === target);
    const contains = exact ? null : (products as any[]).find((p: any) => norm(getProductLabel(p)).includes(target) || target.includes(norm(getProductLabel(p))));
    const match = exact || contains;

    if (match) {
      setProductId(String((match as any).id));
      toast({ title: "Producto seleccionado", description: getProductLabel(match) });
    } else {
      toast({ title: "Producto no encontrado", description: "Selecciona el producto original manualmente.", variant: "destructive" });
    }

    setPrefillDone(true);
  }, [fromQuoteId, prefillDone, dupProductName, products]);

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
    // Reset prompts when product changes, except during duplication prefill
    if (fromQuoteId && !prefillDone) return;
    setPromptValues({});
  }, [productId, fromQuoteId, prefillDone]);

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

  // Ajusta la longitud de qtyInputs según qtyCount
  useEffect(() => {
    setQtyInputs((prev) => {
      if (qtyCount > prev.length) {
        return prev.concat(Array(qtyCount - prev.length).fill(""));
      }
      if (qtyCount < prev.length) {
        return prev.slice(0, qtyCount);
      }
      return prev;
    });
  }, [qtyCount]);

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

  const outputs = useMemo(() => {
    const api = (pricing as any)?.outputValues;
    if (Array.isArray(api) && api.length > 0) return api as any[];
    return Array.isArray(dupResults) ? dupResults : [];
  }, [pricing, dupResults]);
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
          </div>

          <div className="space-y-2">
            <Label>Descripción del presupuesto</Label>
            <Input 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe brevemente este presupuesto..."
            />
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

      {!canShowPanels && dupResults.length > 0 && (
        <Card className="border-accent/50 bg-muted/50">
          <CardHeader>
            <CardTitle>Resultado (desde presupuesto anterior)</CardTitle>
          </CardHeader>
          <CardContent>
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
              <p className="text-sm text-muted-foreground">Resultado cargado desde la copia.</p>
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
) : (multiRows && multiRows.length > 0 ? (
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
        </>
      )}
      {customerId && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Artículos adicionales</h2>
            <Button onClick={addItem}>Agregar artículo</Button>
          </div>

          {extraItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay artículos añadidos.</p>
          ) : (
            <div className="space-y-6">
              {extraItems.map((k) => (
                <QuoteItem
                  key={k}
                  id={k}
                  hasToken={hasToken}
                  initialData={initialItems[k]}
                  onChange={(id, data) => setExtraItemsData((prev) => ({ ...prev, [id as number]: data }))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="flex items-center justify-end gap-3 pt-4">
        <Button onClick={async () => {
          try {
            const parseNumber = (v: any) => {
              if (typeof v === "number") return v;
              const n = parseFloat(String(v ?? "").replace(/\./g, "").replace(",", "."));
              return Number.isNaN(n) ? 0 : n;
            };
            const mainPrice = parseNumber((priceOutput as any)?.value);
            const extrasTotal = Object.values(extraItemsData || {}).reduce((acc: number, it: any) => acc + parseNumber(it?.price), 0);
            const total = mainPrice + extrasTotal;

            const quoteNumber = `P-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;

            const { data: inserted, error } = await supabase
              .from("quotes")
              .insert([{ 
                quote_number: quoteNumber,
                status: "draft",
                customer_id: customerId,
                product_name: selectedProduct ? getProductLabel(selectedProduct) : (dupProductName || null),
                description: description.trim() || null,
                selections: promptValues,
                results: outputs,
                final_price: total
              }])
              .select("id")
              .maybeSingle();

            if (error) throw error;
            const quoteId = inserted?.id;
            if (!quoteId) throw new Error("No se pudo crear el presupuesto.");

            const items = Object.entries(extraItemsData || {}).map(([k, data]: any, index) => ({
              quote_id: quoteId,
              name: `Artículo ${index + 1}`,
              product_id: data?.productId ?? null,
              prompts: data?.prompts ?? {},
              outputs: data?.outputs ?? [],
              multi: data?.multi ?? null,
              total_price: parseNumber(data?.price) || null,
              position: index
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

        <Button variant="secondary" onClick={() => setPdfOpen(true)}>Generar PDF</Button>
      </section>

      <QuotePdfTemplateDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        customer={(customers || []).find((c) => c.id === customerId)}
        main={{
          product: selectedProduct ? getProductLabel(selectedProduct) : "Producto",
          price: (priceOutput as any)?.value ?? null,
          prompts: promptValues,
          outputs,
          multi: multiEnabled ? { qtyLabel, qtyInputs, rows: multiRows } : null,
        }}
        items={Object.values(extraItemsData || {})}
      />
    </main>
  );
};

export default QuoteNew;
