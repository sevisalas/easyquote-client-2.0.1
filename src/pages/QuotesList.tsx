import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
    .select("id, created_at, quote_number, customer_id, product_name, final_price, status, selections, description")
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

  const getStatusVariant = (s: string) => {
    if (s === "approved") return "success" as const;
    if (s === "rejected") return "destructive" as const;
    if (s === "sent") return "default" as const;
    return "secondary" as const; // draft
  };

  return (
    <main className="p-1 md:p-2">
      <header className="sr-only">
        <h1>Listado de presupuestos</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos`} />
        <meta name="description" content="Listado de presupuestos en la aplicación." />
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Listado de presupuestos</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay presupuestos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="py-2">Fecha</TableHead>
                  <TableHead className="py-2">Nº</TableHead>
                  <TableHead className="py-2">Cliente</TableHead>
                  <TableHead className="py-2">Descripción</TableHead>
                  <TableHead className="py-2 text-right">Total</TableHead>
                  <TableHead className="py-2">Estado</TableHead>
                  <TableHead className="py-2">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q: any) => (
                  <TableRow key={q.id} className="h-12">
                    <TableCell className="py-2">{new Date(q.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell className="py-2">{q.quote_number}</TableCell>
                    <TableCell className="py-2">{getCustomerName(q.customer_id)}</TableCell>
                    <TableCell className="py-2">{q.description || ""}</TableCell>
                    <TableCell className="py-2 text-right">{fmtEUR(q.final_price)}</TableCell>
                    <TableCell className="py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0 border-0 bg-transparent cursor-pointer">
                            <Badge variant={getStatusVariant(q.status)} className="cursor-pointer hover:opacity-80">
                              {statusLabel[q.status] || q.status}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-background border shadow-lg z-50">
                          {statusOptions.map((s) => (
                            <DropdownMenuItem key={s} onClick={() => handleStatusChange(q.id, s)}>
                              {statusLabel[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => navigate(`/presupuestos/${q.id}`)}>
                          Ver
                        </Button>
                        {q.status === 'draft' && (
                          <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => navigate(`/presupuestos/editar/${q.id}`)}>
                            Editar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => navigate(`/presupuestos/nuevo?from=${q.id}`)}>
                          Duplicar
                        </Button>
                        {q.status === 'draft' && (
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-7 px-2 text-xs" 
                            onClick={async () => {
                              if (confirm('¿Estás seguro de que quieres eliminar este presupuesto?')) {
                                try {
                                  const { error } = await supabase.from('quotes').delete().eq('id', q.id);
                                  if (error) throw error;
                                  toast({ title: 'Presupuesto eliminado' });
                                  refetch();
                                } catch (e: any) {
                                  toast({ title: 'Error al eliminar', description: e?.message, variant: 'destructive' });
                                }
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        )}
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
