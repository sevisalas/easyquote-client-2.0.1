import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const getStatusVariant = (s: string) => {
  if (s === "approved") return "success" as const;
  if (s === "rejected") return "destructive" as const;
  if (s === "sent") return "default" as const;
  return "secondary" as const; // draft
};

const fmtEUR = (n: any) => {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(num)) return String(n ?? "");
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(num);
};

const fetchQuote = async (id: string) => {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, created_at, quote_number, customer_id, product_name, final_price, status, selections, results")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const fetchCustomer = async (id: string | null | undefined) => {
  if (!id) return null;
  const { data, error } = await supabase.from("customers").select("id, name").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
};

const fetchItems = async (quoteId: string) => {
  const { data, error } = await supabase
    .from("quote_items")
    .select("id, name, product_id, prompts, outputs, total_price, position")
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data || [];
};

const QuoteDetailItem = ({ item, index }: { item: any; index: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const itemDescription = item.name || "";
  const productName = itemDescription || `Artículo ${index + 1}`;
  const price = item.total_price;
  
  // Estado comprimido
  if (!isExpanded) {
    return (
      <Card className="border-l-4 border-l-muted-foreground/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-medium">{productName}</h3>
                  {itemDescription && (
                    <p className="text-sm text-muted-foreground mt-1">{itemDescription}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {price && (
                <span className="font-semibold text-primary">
                  {fmtEUR(price)}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)}>
                Ver detalles
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado expandido - mostrar detalles completos
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{productName}</span>
          <Button variant="outline" size="sm" onClick={() => setIsExpanded(false)}>
            Ocultar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {itemDescription && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Descripción</h4>
            <p className="text-sm">{itemDescription}</p>
          </div>
        )}
        
        {price && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Precio</h4>
            <p className="text-lg font-semibold text-primary">{fmtEUR(price)}</p>
          </div>
        )}

        {item.prompts && Object.keys(item.prompts).length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Configuración</h4>
              <div className="grid gap-2 text-sm">
                {Object.entries(item.prompts).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Resultados</h4>
              <div className="grid gap-2 text-sm">
                {item.outputs.map((output: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-muted-foreground">{output.name || `Resultado ${idx + 1}`}:</span>
                    <span>{String(output.value || "")}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const QuoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Presupuesto ${id} | Detalle`;
  }, [id]);

  const { data: quote } = useQuery({ queryKey: ["quote", id], queryFn: () => fetchQuote(id!), enabled: !!id });
  const { data: customer } = useQuery({ queryKey: ["quote-customer", quote?.customer_id], queryFn: () => fetchCustomer(quote?.customer_id), enabled: !!quote?.customer_id });
  const { data: items = [] } = useQuery({ queryKey: ["quote-items", id], queryFn: () => fetchItems(id!), enabled: !!id });

  return (
    <main className="p-6 space-y-6">
      <header className="sr-only">
        <h1>Detalle de presupuesto</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos/${id}`} />
        <meta name="description" content="Detalle del presupuesto con cliente, estado, total y líneas." />
      </header>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{quote?.quote_number || "Presupuesto"}</h2>
        <div className="flex items-center gap-2">
          {quote?.status && <Badge variant={getStatusVariant(quote.status)}>{statusLabel[quote.status] || quote.status}</Badge>}
          {quote?.status === 'draft' && (
            <Button variant="default" onClick={() => navigate(`/presupuestos/editar/${id}`)}>Editar</Button>
          )}
          <Button variant="secondary" onClick={() => navigate(`/presupuestos/nuevo?from=${id}`)}>Duplicar como nuevo</Button>
          <Button onClick={() => navigate(-1)}>Volver</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">Fecha</div>
            <div>{quote ? new Date(quote.created_at).toLocaleString("es-ES") : "—"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Cliente</div>
            <div>{customer?.name || "—"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Producto</div>
            <div>{quote?.product_name || "—"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="font-semibold">{fmtEUR(quote?.final_price)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artículos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin artículos adicionales.</p>
          ) : (
            items.map((item: any, i: number) => <QuoteDetailItem key={item.id || i} item={item} index={i} />)
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default QuoteDetail;
