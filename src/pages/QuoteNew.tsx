import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  // La API puede devolver lista simple u objeto; normalizamos
  const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
  return list as Product[];
};

const QuoteNew = () => {
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [productId, setProductId] = useState<string | undefined>();

  useEffect(() => {
    document.title = "Nuevo Presupuesto | Productos y Cliente";
  }, []);

  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const { data: products } = useQuery({ queryKey: ["easyquote-products"], queryFn: fetchProducts });

  const canShowPanels = useMemo(() => !!customerId && !!productId, [customerId, productId]);

  useEffect(() => {
    if (!products) return;
  }, [products]);

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
            <Select onValueChange={setProductId} value={productId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige un producto" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name || p.title || p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {canShowPanels && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Prompts del producto</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Aquí mostraremos los prompts dinámicos del producto seleccionado.</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Resultados y salidas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Aquí verás los resultados del cálculo y los outputs.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
};

export default QuoteNew;
