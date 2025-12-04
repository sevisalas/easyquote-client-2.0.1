import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X, Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CustomerName } from "@/components/quotes/CustomerName";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { QuoteCard } from "@/components/quotes/QuoteCard";
import { useIsMobile } from "@/hooks/use-mobile";

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
  // Filtrar por organization_id para separar datos por tenant
  const organizationId = sessionStorage.getItem('selected_organization_id');
  
  let query = supabase
    .from("quotes")
    .select("id, created_at, quote_number, customer_id, product_name, final_price, status, selections, description, holded_estimate_number, holded_estimate_id, user_id, organization_id")
    .order("created_at", { ascending: false });
  
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const fetchOrgMembers = async () => {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, display_name");
  if (error) throw error;
  return data || [];
};

const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name");
  if (error) throw error;
  return data || [];
};

const QuotesList = () => {
  const navigate = useNavigate();
  const { isHoldedActive, hasHoldedAccess } = useHoldedIntegration();
  const isMobile = useIsMobile();
  
  // Filter states
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [quoteNumberFilter, setQuoteNumberFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>();
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>();
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    document.title = "Presupuestos | Listado";
  }, []);

  const { data: quotes = [], refetch } = useQuery({ queryKey: ["quotes"], queryFn: fetchQuotes });
  const { data: customers = [] } = useQuery({ 
    queryKey: ["customers"], 
    queryFn: fetchCustomers
  });
  const { data: orgMembers = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: fetchOrgMembers
  });

  const getCustomerName = (id?: string | null) => customers.find((c: any) => c.id === id)?.name || "—";
  const getUserName = (userId?: string | null) => orgMembers.find((m: any) => m.user_id === userId)?.display_name || "—";

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [customerFilter, statusFilter, quoteNumberFilter, dateFromFilter, dateToFilter]);

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
  }, [quotes, customerFilter, statusFilter, quoteNumberFilter, dateFromFilter, dateToFilter, customers, orgMembers]);

  // Paginated quotes
  const paginatedQuotes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredQuotes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredQuotes, currentPage, itemsPerPage]);

  const clearAllFilters = () => {
    setCustomerFilter("");
    setStatusFilter("");
    setQuoteNumberFilter("");
    setDateFromFilter(undefined);
    setDateToFilter(undefined);
  };

  const hasActiveFilters = customerFilter || statusFilter || quoteNumberFilter || dateFromFilter || dateToFilter;

  const getStatusVariant = (s: string) => {
    if (s === "approved") return "success" as const;
    if (s === "rejected") return "destructive" as const;
    if (s === "sent") return "secondary" as const;
    return "outline" as const; // draft
  };

  const handleDownloadHoldedPdf = async (holdedEstimateId: string, holdedEstimateNumber: string, customerId: string) => {
    try {
      toast({ title: "Descargando PDF..." });
      
      const organizationId = sessionStorage.getItem('selected_organization_id');
      
      const response = await fetch(
        `https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-download-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ holdedEstimateId, organization_id: organizationId })
        }
      );

      if (!response.ok) {
        throw new Error('Error al descargar el PDF');
      }

      // Get PDF as blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${holdedEstimateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "PDF descargado correctamente" });
    } catch (e: any) {
      console.error('Error downloading Holded PDF:', e);
      toast({ 
        title: "Error al descargar PDF", 
        description: e?.message || "No se pudo descargar el PDF de Holded", 
        variant: "destructive" 
      });
    }
  };

  return (
    <main className="p-0 md:p-2">
      <header className="sr-only">
        <h1>Listado de presupuestos</h1>
        <link rel="canonical" href={`${window.location.origin}/presupuestos`} />
        <meta name="description" content="Listado de presupuestos en la aplicación." />
      </header>

      <Card className="border-0 md:border shadow-none md:shadow-sm">
        <CardHeader className="pb-2 px-3 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base md:text-lg">Presupuestos</CardTitle>
            <Button 
              size={isMobile ? "default" : "sm"}
              onClick={() => navigate('/presupuestos/nuevo')}
              className="h-9 md:h-8 text-sm md:text-xs px-4 md:px-3"
            >
              Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {/* Filters Section */}
          <div className="mb-3 p-2 md:p-3 bg-muted/30 rounded border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Customer Filter */}
              <div className="relative">
                <Search className="absolute left-2 top-2 md:top-1.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Cliente..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="h-9 md:h-7 text-sm md:text-xs pl-7"
                />
              </div>

              {/* Status Filter */}
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 md:h-6 text-sm md:text-xs px-2">
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
                  className="h-9 md:h-6 text-sm md:text-xs px-2"
                />
              </div>

              {/* Date From Filter */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 md:h-6 w-full justify-start text-left font-normal text-sm md:text-xs px-2 md:px-1",
                        !dateFromFilter && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1 h-3 md:h-2 w-3 md:w-2" />
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
                        "h-9 md:h-6 w-full justify-start text-left font-normal text-sm md:text-xs px-2 md:px-1",
                        !dateToFilter && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1 h-3 md:h-2 w-3 md:w-2" />
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
                  className="h-8 md:h-6 text-sm md:text-xs px-3 md:px-2"
                >
                  <X className="w-4 md:w-3 h-4 md:h-3 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="mb-2 text-xs md:text-xs text-muted-foreground px-1">
            {filteredQuotes.length} de {quotes.length} presupuestos
          </div>

          {filteredQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">
              {quotes.length === 0 ? "Aún no hay presupuestos." : "No se encontraron presupuestos con los filtros aplicados."}
            </p>
          ) : isMobile ? (
            // Vista móvil con tarjetas
            <div className="space-y-0">
              {paginatedQuotes.map((q: any) => (
                <QuoteCard
                  key={q.id}
                  quote={q}
                  getUserName={getUserName}
                  fmtEUR={fmtEUR}
                  getStatusVariant={getStatusVariant}
                  statusLabel={statusLabel}
                  isHoldedActive={isHoldedActive}
                  hasHoldedAccess={hasHoldedAccess}
                  onRefetch={refetch}
                  handleDownloadHoldedPdf={handleDownloadHoldedPdf}
                />
              ))}
            </div>
          ) : (
            // Vista desktop con tabla
            <Table>
              <TableHeader>
                <TableRow className="h-9">
                  <TableHead className="py-2 text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Nº</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Usuario</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Descripción</TableHead>
                  <TableHead className="py-2 text-right text-xs font-semibold">Total</TableHead>
                  {hasHoldedAccess && (
                    <>
                      <TableHead className="py-2 text-xs font-semibold">Nº Holded</TableHead>
                      <TableHead className="py-2 text-xs font-semibold">PDF</TableHead>
                    </>
                  )}
                  <TableHead className="py-2 text-xs font-semibold">Estado</TableHead>
                  <TableHead className="py-2 text-xs font-semibold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedQuotes.map((q: any) => (
                  <TableRow key={q.id} className="h-auto">
                    <TableCell className="py-1.5 px-3 text-sm">{new Date(q.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell className="py-1.5 px-3 text-sm font-medium">{q.quote_number}</TableCell>
                    <TableCell className="py-1.5 px-3 text-sm">
                      <CustomerName customerId={q.customer_id} />
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-sm text-muted-foreground">{getUserName(q.user_id)}</TableCell>
                    <TableCell className="py-1.5 px-3 text-sm">{q.description || ""}</TableCell>
                    <TableCell className="py-1.5 px-3 text-sm text-right font-medium">{fmtEUR(q.final_price)}</TableCell>
                    {hasHoldedAccess && (
                      <>
                        <TableCell className="py-1.5 px-3">
                          {q.holded_estimate_number ? (
                            <span className="text-xs font-mono text-muted-foreground">{q.holded_estimate_number}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-3">
                          {q.holded_estimate_id && isHoldedActive && (
                            <span title="Descargar PDF de Holded">
                              <Download 
                                className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" 
                                onClick={() => handleDownloadHoldedPdf(q.holded_estimate_id, q.holded_estimate_number || q.quote_number, q.customer_id)}
                              />
                            </span>
                          )}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="py-1.5 px-3">
                      <Badge variant={getStatusVariant(q.status)} className="text-xs px-2 py-0 h-5">
                        {statusLabel[q.status] || q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-popover z-50">
                          <DropdownMenuItem onClick={() => navigate(`/presupuestos/${q.id}`)} className="cursor-pointer">
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/presupuestos/nuevo?from=${q.id}`)} className="cursor-pointer">
                            Duplicar
                          </DropdownMenuItem>
                          {q.status === 'draft' && (
                            <DropdownMenuItem 
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
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {filteredQuotes.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-1 md:gap-2 mt-4 px-1">
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="Primera página"
                className="h-9 md:h-8 w-9 md:w-auto p-0 md:px-3"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                title="Anterior"
                className="h-9 md:h-8 w-9 md:w-auto p-0 md:px-3"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Números de página */}
              {(() => {
                const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage);
                const pageNumbers = [];
                const showPages = 5;
                
                let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
                let endPage = Math.min(totalPages, startPage + showPages - 1);
                
                if (endPage - startPage < showPages - 1) {
                  startPage = Math.max(1, endPage - showPages + 1);
                }
                
                if (startPage > 1) {
                  pageNumbers.push(
                    <Button
                      key={1}
                      variant={currentPage === 1 ? "default" : "outline"}
                      size={isMobile ? "default" : "sm"}
                      onClick={() => setCurrentPage(1)}
                      className="h-9 md:h-8 min-w-[36px] md:min-w-0"
                    >
                      1
                    </Button>
                  );
                  if (startPage > 2) {
                    pageNumbers.push(
                      <span key="dots1" className="px-2">...</span>
                    );
                  }
                }
                
                for (let i = startPage; i <= endPage; i++) {
                  pageNumbers.push(
                    <Button
                      key={i}
                      variant={currentPage === i ? "default" : "outline"}
                      size={isMobile ? "default" : "sm"}
                      onClick={() => setCurrentPage(i)}
                      className="h-9 md:h-8 min-w-[36px] md:min-w-0"
                    >
                      {i}
                    </Button>
                  );
                }
                
                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pageNumbers.push(
                      <span key="dots2" className="px-2">...</span>
                    );
                  }
                  pageNumbers.push(
                    <Button
                      key={totalPages}
                      variant={currentPage === totalPages ? "default" : "outline"}
                      size={isMobile ? "default" : "sm"}
                      onClick={() => setCurrentPage(totalPages)}
                      className="h-9 md:h-8 min-w-[36px] md:min-w-0"
                    >
                      {totalPages}
                    </Button>
                  );
                }
                
                return pageNumbers;
              })()}
              
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                disabled={currentPage >= Math.ceil(filteredQuotes.length / itemsPerPage)}
                title="Siguiente"
                className="h-9 md:h-8 w-9 md:w-auto p-0 md:px-3"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => setCurrentPage(Math.ceil(filteredQuotes.length / itemsPerPage))}
                disabled={currentPage >= Math.ceil(filteredQuotes.length / itemsPerPage)}
                title="Última página"
                className="h-9 md:h-8 w-9 md:w-auto p-0 md:px-3"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default QuotesList;
