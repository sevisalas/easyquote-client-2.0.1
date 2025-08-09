import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  useEffect(() => {
    document.title = "Nuevo Presupuesto | Productos y Cliente";
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEqEmail(data.user?.email ?? ""));
  }, []);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const { data: products } = useQuery({ queryKey: ["easyquote-products"], queryFn: fetchProducts, retry: 1, enabled: hasToken });
  const { data: pricing, error: pricingError } = useQuery({
    queryKey: ["easyquote-pricing", productId, promptValues],
    enabled: hasToken && !!productId,
    retry: 1,
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
        body: { token, productId, inputs: promptValues },
      });
      if (error) throw error as any;
      return data;
    },
  });

  const selectedProduct = useMemo(() => products?.find((p: any) => String(p.id) === String(productId)), [products, productId]);
  const canShowPanels = useMemo(() => !!customerId && !!productId, [customerId, productId]);
  const handlePromptChange = (id: string, value: any) => {
    setPromptValues((prev) => ({ ...prev, [id]: value }));
  };

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
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default QuoteNew;
