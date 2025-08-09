import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const statusOptions = ["draft", "sent", "approved", "rejected"] as const;
const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const fmtEUR = (n: any) => {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(num)) return String(n ?? "");
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(num);
};

const fetchQuotes = async () => {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, created_at, quote_number, customer_id, product_name, final_price, status, selections")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

const fetchCustomers = async () => {
  const { data, error } = await supabase.from("customers").select("id, name");
  if (error) throw error;
  return data || [];
};

const QuotesList = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Presupuestos | Listado";
  }, []);

  const { data: quotes = [], refetch } = useQuery({ queryKey: ["quotes"], queryFn: fetchQuotes });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });

  const getCustomerName = (id?: string | null) => customers.find((c: any) => c.id === id)?.name || "—";

  const handleStatusChange = async (id: string, next: string) => {
    try {
      const { error } = await supabase.from("quotes").update({ status: next }).eq("id", id);
      if (error) throw error;
      toast({ title: "Estado actualizado" });
      refetch();
    } catch (e: any) {
      toast({ title: "No se pudo actualizar el estado", description: e?.message || "Inténtalo de nuevo", variant: "destructive" });
    }
  };

  return (
    <main className="p-6 space-y-6">
      <header className="sr-only">
        <h1>Listado de presupuestos</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos`} />
        <meta name="description" content="Listado de presupuestos en la aplicación." />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Listado de presupuestos</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay presupuestos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell>{new Date(q.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell>{q.quote_number}</TableCell>
                    <TableCell>{getCustomerName(q.customer_id)}</TableCell>
                    <TableCell>{q.product_name || "—"}</TableCell>
                    <TableCell className="text-right">{fmtEUR(q.final_price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{statusLabel[q.status] || q.status}</Badge>
                        <Select value={q.status} onValueChange={(v) => handleStatusChange(q.id, v)}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((s) => (
                              <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/presupuestos/nuevo?from=${q.id}`)}>
                          Duplicar como nuevo
                        </Button>
                      </div>
                    </TableCell>
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

export default QuotesList;
