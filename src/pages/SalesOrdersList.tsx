import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Eye, Copy, X, Search, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const statusColors = {
  pending: "default",
  in_production: "secondary",
  completed: "default",
  cancelled: "destructive",
} as const;

const statusLabels = {
  pending: "Pendiente",
  in_production: "En Producción",
  completed: "Completado",
  cancelled: "Cancelado",
};

const SalesOrdersList = () => {
  const navigate = useNavigate();
  const { canAccessProduccion } = useSubscription();
  const { loading, fetchSalesOrders } = useSalesOrders();
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

  const getCustomerName = (id?: string | null) => 
    customers.find((c: any) => c.id === id)?.name || "—";

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order: SalesOrder) => {
      // Customer filter
      if (customerFilter && !getCustomerName(order.customer_id).toLowerCase().includes(customerFilter.toLowerCase())) {
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

  const handleDuplicate = async (orderId: string) => {
    try {
      const originalOrder = orders.find(o => o.id === orderId);
      if (!originalOrder) return;

      toast.loading("Duplicando pedido...");

      // Fetch order items and additionals
      const { data: items } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', orderId);

      const { data: additionals } = await supabase
        .from('sales_order_additionals')
        .select('*')
        .eq('sales_order_id', orderId);

      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          user_id: originalOrder.user_id,
          customer_id: originalOrder.customer_id,
          order_number: `TEMP-${Date.now()}`, // Temporal, se actualizará
          title: originalOrder.title ? `${originalOrder.title} (Copia)` : undefined,
          description: originalOrder.description,
          notes: originalOrder.notes,
          subtotal: originalOrder.subtotal,
          discount_amount: originalOrder.discount_amount,
          tax_amount: originalOrder.tax_amount,
          final_price: originalOrder.final_price,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Generate proper order number
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true })
        .like('order_number', `SO-${year}-%`);
      
      const nextNumber = (count || 0) + 1;
      const newOrderNumber = `SO-${year}-${String(nextNumber).padStart(4, '0')}`;

      // Update with proper order number
      await supabase
        .from('sales_orders')
        .update({ order_number: newOrderNumber })
        .eq('id', newOrder.id);

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
            outputs: item.outputs,
            multi: item.multi
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

      toast.success("Pedido duplicado correctamente");
      loadOrders();
      navigate(`/pedidos/${newOrder.id}`);
    } catch (error) {
      console.error('Error duplicating order:', error);
      toast.error("Error al duplicar el pedido");
    }
  };

  if (!canAccessProduccion()) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Pedidos
          </h1>
          <p className="text-muted-foreground">Gestiona pedidos de producción desde presupuestos aprobados o creados desde cero</p>
        </div>
        <Button onClick={() => navigate("/pedidos/nuevo")}>
          Crear nuevo pedido
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de pedidos</CardTitle>
          <CardDescription>
            {filteredOrders.length} de {orders.length} pedido{orders.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cliente..."
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_production">En Producción</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="N°..."
              value={orderNumberFilter}
              onChange={(e) => setOrderNumberFilter(e.target.value)}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFromFilter && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFromFilter ? format(dateFromFilter, "PPP") : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dateFromFilter} onSelect={setDateFromFilter} initialFocus />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !dateToFilter && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateToFilter ? format(dateToFilter, "PPP") : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dateToFilter} onSelect={setDateToFilter} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar filtros
            </Button>
          )}

          {loading ? (
            <div className="text-center py-8">Cargando pedidos...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>N°</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No hay pedidos que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{new Date(order.order_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{getCustomerName(order.customer_id)}</TableCell>
                      <TableCell className="max-w-xs truncate">{order.description || order.title || "—"}</TableCell>
                      <TableCell>{order.final_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/pedidos/${order.id}`)}>
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDuplicate(order.id)}>
                            <Copy className="h-4 w-4" />
                            Duplicar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesOrdersList;
