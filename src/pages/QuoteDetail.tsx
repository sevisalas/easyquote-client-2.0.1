import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <CardTitle>Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(quote?.results) && quote!.results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote!.results.map((o: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{o.name ?? "Campo"}</TableCell>
                    <TableCell>{String(o.value ?? "")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin artículos adicionales.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it: any, i: number) => (
                  <TableRow key={it.id || i}>
                    <TableCell>{it.name || `Artículo ${i + 1}`}</TableCell>
                    <TableCell>{fmtEUR(it.total_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default QuoteDetail;
