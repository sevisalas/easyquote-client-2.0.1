import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Copy, X, Search, CalendarIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useSalesOrders, SalesOrder } from "@/hooks/useSalesOrders";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CustomerName } from "@/components/quotes/CustomerName";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";

const statusColors = {
  draft: "outline",
  pending: "default",
  in_production: "secondary",
  completed: "default",
} as const;

const statusLabels = {
  draft: "Borrador",
  pending: "Pendiente",
  in_production: "En Producción",
  completed: "Completado",
};

const fmtEUR = (n: any) => {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(num)) return String(n ?? "");
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(num);
};

const SalesOrdersList = () => {
  const navigate = useNavigate();
  const { canAccessProduccion } = useSubscription();
  const { loading, fetchSalesOrders } = useSalesOrders();
  const { isHoldedActive } = useHoldedIntegration();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  // Filter states
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>();
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>();

  useEffect(() => {
    if (!canAccessProduccion()) {
      navigate("/");
      return;
    }
    loadOrders();
    loadCustomers();
  }, [canAccessProduccion, navigate]);

  // Auto-sync missing Holded numbers
  useEffect(() => {
    const syncMissingHoldedNumbers = async () => {
      console.log("=== SYNC CHECK ===");
      console.log("isHoldedActive:", isHoldedActive);
      console.log("orders.length:", orders.length);
      
      if (!isHoldedActive) {
        console.log("❌ Holded not active, skipping sync");
        return;
      }
      
      const ordersNeedingSync = orders.filter(
        o => o.holded_document_id && !o.holded_document_number
      );

      console.log("Orders needing sync:", ordersNeedingSync.length, ordersNeedingSync.map(o => o.order_number));

      if (ordersNeedingSync.length === 0) {
        console.log("✓ No orders need sync");
        return;
      }

      console.log(`🔄 Sincronizando ${ordersNeedingSync.length} números de Holded...`);

      for (const order of ordersNeedingSync) {
        try {
          console.log(`Syncing order ${order.order_number}...`);
          const { data, error } = await supabase.functions.invoke('holded-sync-order-number', {
            body: { orderId: order.id }
          });

          if (error) {
            console.error('Error syncing Holded number:', error);
            continue;
          }

          if (data?.holdedNumber) {
            setOrders(prevOrders =>
              prevOrders.map(o =>
                o.id === order.id
                  ? { ...o, holded_document_number: data.holdedNumber }
                  : o
              )
            );
            console.log(`✓ Sincronizado número ${data.holdedNumber} para ${order.order_number}`);
          } else {
            console.log('No holdedNumber in response:', data);
          }
        } catch (error) {
          console.error('Error syncing order', order.order_number, error);
        }
      }
    };

    if (orders.length > 0) {
      console.log("Triggering sync with", orders.length, "orders");
      syncMissingHoldedNumbers();
    } else {
      console.log("No orders yet, skipping sync");
    }
  }, [orders.length, isHoldedActive]);

  const loadOrders = async () => {
    const data = await fetchSalesOrders();
    setOrders(data);
  };

  const loadCustomers = async () => {
    // Fetch local customers
    const { data: localCustomers } = await supabase
      .from("customers")
      .select("id, name");

    // Fetch Holded contacts
    const { data: holdedContacts } = await supabase
      .from("holded_contacts")
      .select("id, name");

    setCustomers([...(localCustomers || []), ...(holdedContacts || [])]);
  };

  const getCustomerName = (customerId?: string | null, holdedContactId?: string | null) => {
    const id = customerId || holdedContactId;
    return customers.find((c: any) => c.id === id)?.name || "—";
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order: SalesOrder) => {
      // Customer filter
      if (customerFilter && !getCustomerName(order.customer_id, order.holded_contact_id).toLowerCase().includes(customerFilter.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (statusFilter && statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }
      
      // Order number filter
      if (orderNumberFilter && !order.order_number?.toLowerCase().includes(orderNumberFilter.toLowerCase())) {
        return false;
      }
      
      // Date filters
      const orderDate = new Date(order.order_date);
      if (dateFromFilter && orderDate < dateFromFilter) {
        return false;
      }
      if (dateToFilter && orderDate > dateToFilter) {
        return false;
      }
      
      return true;
    });
  }, [orders, customerFilter, statusFilter, orderNumberFilter, dateFromFilter, dateToFilter, customers]);

  const clearAllFilters = () => {
    setCustomerFilter("");
    setStatusFilter("");
    setOrderNumberFilter("");
    setDateFromFilter(undefined);
    setDateToFilter(undefined);
  };

  const hasActiveFilters = customerFilter || statusFilter || orderNumberFilter || dateFromFilter || dateToFilter;

  const handleDownloadHoldedPdf = async (holdedDocumentId: string, orderNumber: string) => {
    try {
      toast.loading('Descargando PDF...');
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('No hay sesión activa');
        return;
      }

      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-download-pdf',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ 
            holdedDocumentId: holdedDocumentId,
            documentType: 'salesorder'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Error al descargar el PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF descargado correctamente');
    } catch (error: any) {
      console.error('Error downloading Holded PDF:', error);
      toast.error('Error al descargar el PDF de Holded');
    }
  };

  const handleDuplicate = async (orderId: string) => {
    const toastId = toast.loading("Duplicando pedido...");
    
    try {
      const originalOrder = orders.find(o => o.id === orderId);
      if (!originalOrder) {
        toast.dismiss(toastId);
        return;
      }

      // Fetch order items and additionals
      const { data: items } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', orderId);

      const { data: additionals } = await supabase
        .from('sales_order_additionals')
        .select('*')
        .eq('sales_order_id', orderId);

      // Generate proper order number using atomic function
      const { data: orderNumber, error: numberError } = await (supabase.rpc as any)('generate_sales_order_number');
      
      if (numberError || !orderNumber) {
        throw new Error('No se pudo generar el número de pedido');
      }

      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          user_id: originalOrder.user_id,
          customer_id: originalOrder.customer_id,
          order_number: orderNumber,
          title: originalOrder.title ? `${originalOrder.title} (Copia)` : undefined,
          description: originalOrder.description,
          notes: originalOrder.notes,
          subtotal: originalOrder.subtotal,
          discount_amount: originalOrder.discount_amount,
          tax_amount: originalOrder.tax_amount,
          final_price: originalOrder.final_price,
          status: 'draft',
          created_from_scratch: originalOrder.created_from_scratch
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Copy items
      if (items && items.length > 0) {
        await supabase.from('sales_order_items').insert(
          items.map(item => ({
            sales_order_id: newOrder.id,
            product_id: item.product_id,
            product_name: item.product_name,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            prompts: item.prompts,
            outputs: item.outputs
          }))
        );
      }

      // Copy additionals
      if (additionals && additionals.length > 0) {
        await supabase.from('sales_order_additionals').insert(
          additionals.map(add => ({
            sales_order_id: newOrder.id,
            name: add.name,
            type: add.type,
            value: add.value,
            is_discount: add.is_discount
          }))
        );
      }

      toast.dismiss(toastId);
      toast.success("Pedido duplicado correctamente");
      loadOrders();
      navigate(`/pedidos/${newOrder.id}`);
    } catch (error) {
      console.error('Error duplicating order:', error);
      toast.dismiss(toastId);
      toast.error("Error al duplicar el pedido");
    }
  };

  if (!canAccessProduccion()) {
    return null;
  }

  return (
    <main className="p-1 md:p-2">
      <header className="sr-only">
        <h1>Listado de pedidos</h1>
        <link rel="canonical" href={`${window.location.origin}/pedidos`} />
        <meta name="description" content="Listado de pedidos en la aplicación." />
      </header>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Listado de pedidos</CardTitle>
            <Button 
              size="sm" 
              onClick={() => navigate('/pedidos/nuevo')}
              className="h-8 text-xs"
            >
              Nuevo Pedido
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
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_production">En Producción</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Order Number Filter */}
              <div>
                <Input
                  placeholder="Nº..."
                  value={orderNumberFilter}
                  onChange={(e) => setOrderNumberFilter(e.target.value)}
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
            {filteredOrders.length} de {orders.length} pedidos
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando pedidos...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {orders.length === 0 ? "Aún no hay pedidos." : "No se encontraron pedidos con los filtros aplicados."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-9">
                  <TableHead className="py-2 text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Nº</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Descripción</TableHead>
                  <TableHead className="py-2 text-right text-xs font-semibold">Total</TableHead>
                  {isHoldedActive && (
                    <>
                      <TableHead className="py-2 text-xs font-semibold">Nº Holded</TableHead>
                      <TableHead className="py-2 text-xs font-semibold">PDF</TableHead>
                    </>
                  )}
                  <TableHead className="py-2 text-xs font-semibold">Estado</TableHead>
                  <TableHead className="py-2 text-xs font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} className="h-auto">
                    <TableCell className="py-1.5 px-3 text-sm">{new Date(order.order_date).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell className="py-1.5 px-3 text-sm font-medium">{order.order_number}</TableCell>
                    <TableCell className="py-1.5 px-3 text-sm">
                      <CustomerName customerId={order.customer_id} holdedContactId={order.holded_contact_id} />
                    </TableCell>
                    <TableCell className="py-1.5 px-3 text-sm">{order.description || order.title || ""}</TableCell>
                    <TableCell className="py-1.5 px-3 text-sm text-right font-medium">{fmtEUR(order.final_price)}</TableCell>
                    {isHoldedActive && (
                      <>
                        <TableCell className="py-1.5 px-3">
                          {order.holded_document_number ? (
                            <span className="text-xs font-mono text-muted-foreground">{order.holded_document_number}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-3">
                          {order.holded_document_id && (
                            <span title="Descargar PDF de Holded">
                              <Download 
                                className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" 
                                onClick={() => handleDownloadHoldedPdf(order.holded_document_id!, order.holded_document_number || order.order_number)}
                              />
                            </span>
                          )}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="py-1.5 px-3">
                      <Badge variant={statusColors[order.status]} className="text-xs px-2 py-0 h-5">
                        {statusLabels[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 px-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => navigate(`/pedidos/${order.id}`)}>
                          Ver
                        </Button>
                        <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => handleDuplicate(order.id)}>
                          Duplicar
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

export default SalesOrdersList;
