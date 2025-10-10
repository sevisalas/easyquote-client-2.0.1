import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CustomerName } from "@/components/quotes/CustomerName";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";

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
  const { isHoldedActive } = useHoldedIntegration();
  
  // Filter states
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [quoteNumberFilter, setQuoteNumberFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>();
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>();

  useEffect(() => {
    document.title = "Presupuestos | Listado";
  }, []);

  const { data: quotes = [], refetch } = useQuery({ queryKey: ["quotes"], queryFn: fetchQuotes });
  const { data: customers = [] } = useQuery({ 
    queryKey: ["customers"], 
    queryFn: fetchCustomers
  });

  const getCustomerName = (id?: string | null) => customers.find((c: any) => c.id === id)?.name || "—";

  // Filtered quotes based on all filters
  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote: any) => {
      // Customer filter
      if (customerFilter && !getCustomerName(quote.customer_id).toLowerCase().includes(customerFilter.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (statusFilter && statusFilter !== "all" && quote.status !== statusFilter) {
        return false;
      }
      
      // Quote number filter
      if (quoteNumberFilter && !quote.quote_number?.toLowerCase().includes(quoteNumberFilter.toLowerCase())) {
        return false;
      }
      
      // Date filters
      const quoteDate = new Date(quote.created_at);
      if (dateFromFilter && quoteDate < dateFromFilter) {
        return false;
      }
      if (dateToFilter && quoteDate > dateToFilter) {
        return false;
      }
      
      return true;
    });
  }, [quotes, customerFilter, statusFilter, quoteNumberFilter, dateFromFilter, dateToFilter, customers]);

  const clearAllFilters = () => {
    setCustomerFilter("");
    setStatusFilter("");
    setQuoteNumberFilter("");
    setDateFromFilter(undefined);
    setDateToFilter(undefined);
  };

  const hasActiveFilters = customerFilter || statusFilter || quoteNumberFilter || dateFromFilter || dateToFilter;

  const handleStatusChange = async (id: string, next: string) => {
    try {
      const { error } = await supabase.from("quotes").update({ status: next }).eq("id", id);
      if (error) throw error;
      toast({ title: "Estado actualizado" });
      
      // Si el nuevo estado es "sent" y Holded está activo, exportar automáticamente
      if (next === "sent" && isHoldedActive) {
        try {
          const { data, error: holdedError } = await supabase.functions.invoke('holded-export-estimate', {
            body: { quoteId: id }
          });

          if (holdedError) throw holdedError;

          toast({
            title: "Exportado a Holded",
            description: `Presupuesto exportado como ${data?.estimateNumber || 'estimate'}`,
          });
        } catch (holdedErr: any) {
          console.error('Error exporting to Holded:', holdedErr);
          toast({
            title: "Error al exportar a Holded",
            description: holdedErr.message || "No se pudo exportar el presupuesto a Holded",
            variant: "destructive",
          });
        }
      }
      
      refetch();
    } catch (e: any) {
      toast({ title: "No se pudo actualizar el estado", description: e?.message || "Inténtalo de nuevo", variant: "destructive" });
    }
  };

  const getStatusVariant = (s: string) => {
    if (s === "approved") return "success" as const;
    if (s === "rejected") return "destructive" as const;
    if (s === "sent") return "secondary" as const;
    return "outline" as const; // draft
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Listado de presupuestos</CardTitle>
            <Button 
              size="sm" 
              onClick={() => navigate('/presupuestos/nuevo')}
              className="h-8 text-xs"
            >
              Nuevo Presupuesto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {/* Filters Section */}
          <div className="mb-3 p-3 bg-muted/30 rounded border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Customer Filter */}
              <div className="relative">
                <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Cliente..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="h-7 text-xs pl-7"
                />
              </div>

              {/* Status Filter */}
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-6 text-xs px-2">
                    <SelectValue placeholder="Estado..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quote Number Filter */}
              <div>
                <Input
                  placeholder="Nº..."
                  value={quoteNumberFilter}
                  onChange={(e) => setQuoteNumberFilter(e.target.value)}
                  className="h-6 text-xs px-2"
                />
              </div>

              {/* Date From Filter */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-6 w-full justify-start text-left font-normal text-xs px-1",
                        !dateFromFilter && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1 h-2 w-2" />
                      {dateFromFilter ? format(dateFromFilter, "dd/MM") : "Desde"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFromFilter}
                      onSelect={setDateFromFilter}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To Filter */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-6 w-full justify-start text-left font-normal text-xs px-1",
                        !dateToFilter && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1 h-2 w-2" />
                      {dateToFilter ? format(dateToFilter, "dd/MM") : "Hasta"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateToFilter}
                      onSelect={setDateToFilter}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-6 text-xs px-2"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="mb-2 text-xs text-muted-foreground">
            {filteredQuotes.length} de {quotes.length} presupuestos
          </div>

          {filteredQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {quotes.length === 0 ? "Aún no hay presupuestos." : "No se encontraron presupuestos con los filtros aplicados."}
            </p>
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
                {filteredQuotes.map((q: any) => (
                  <TableRow key={q.id} className="h-12">
                    <TableCell className="py-2">{new Date(q.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell className="py-2">{q.quote_number}</TableCell>
                    <TableCell className="py-2"><CustomerName customerId={q.customer_id} /></TableCell>
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
                        <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => navigate(`/presupuestos/nuevo?from=${q.id}`)}>
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
