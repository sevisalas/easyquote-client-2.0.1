import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Calendar, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useSalesOrders, SalesOrder, SalesOrderItem, SalesOrderAdditional } from "@/hooks/useSalesOrders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditOrderItemDialog } from "@/components/sales/EditOrderItemDialog";

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

const SalesOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canAccessProduccion } = useSubscription();
  const { loading, fetchSalesOrderById, fetchSalesOrderItems, fetchSalesOrderAdditionals, updateSalesOrderStatus, updateSalesOrderItem, recalculateSalesOrderTotals, deleteSalesOrder } = useSalesOrders();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [additionals, setAdditionals] = useState<SalesOrderAdditional[]>([]);
  const [editingItem, setEditingItem] = useState<SalesOrderItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!canAccessProduccion()) {
      navigate("/");
      return;
    }
    if (id) {
      loadOrderData();
    }
  }, [id, canAccessProduccion, navigate]);

  const loadOrderData = async () => {
    if (!id) return;
    const orderData = await fetchSalesOrderById(id);
    setOrder(orderData);
    
    if (orderData) {
      const itemsData = await fetchSalesOrderItems(id);
      setItems(itemsData);
      
      const additionalsData = await fetchSalesOrderAdditionals(id);
      setAdditionals(additionalsData);
    }
  };

  const handleStatusChange = async (newStatus: SalesOrder['status']) => {
    if (!id) return;
    const success = await updateSalesOrderStatus(id, newStatus);
    if (success) {
      setOrder(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const success = await deleteSalesOrder(id);
    if (success) {
      navigate("/pedidos");
    }
  };

  const handleEditItem = (item: SalesOrderItem) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleSaveItemEdit = async (itemId: string, updates: { quantity: number; price: number; description?: string }) => {
    const success = await updateSalesOrderItem(itemId, updates);
    if (success && id) {
      // Recalculate totals
      await recalculateSalesOrderTotals(id);
      // Reload data
      await loadOrderData();
    }
  };

  if (!canAccessProduccion()) {
    return null;
  }

  if (loading || !order) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">Cargando pedido...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pedidos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Pedido {order.order_number}
          </h1>
          <p className="text-muted-foreground">Detalle del pedido</p>
        </div>
        <Badge variant={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-5 w-5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El pedido {order.order_number} será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Pedido</CardTitle>
          <CardDescription>Pedido: {order.order_number}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {order.title && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Título</label>
                <p className="text-base">{order.title}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Estado</label>
              <Select value={order.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_production">En Producción</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {order.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descripción</label>
              <p className="text-base whitespace-pre-wrap">{order.description}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha de pedido
              </label>
              <p className="text-base">{new Date(order.order_date).toLocaleDateString()}</p>
            </div>
            {order.valid_until && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Válido hasta
                </label>
                <p className="text-base">{new Date(order.valid_until).toLocaleDateString()}</p>
              </div>
            )}
            {order.delivery_date && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha de entrega
                </label>
                <p className="text-base">{new Date(order.delivery_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {order.notes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notas</label>
              <p className="text-base whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}

          {order.terms_conditions && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Términos y condiciones</label>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{order.terms_conditions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Artículos del pedido</CardTitle>
          <CardDescription>{items.length} artículo{items.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <div className="space-y-4">
              {items.map((item, index) => {
                const itemOutputs = item.outputs && Array.isArray(item.outputs) ? item.outputs : [];
                const itemPrompts = item.prompts && Array.isArray(item.prompts) ? item.prompts : [];
                const itemMulti = item.multi as any;
                
                // Determine the actual quantity - use database quantity directly
                let displayQuantity = item.quantity;
                
                return (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.product_name}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditItem(item)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <div className="text-right">
                          <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-primary">{item.price.toFixed(2)} €</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Cantidad: {displayQuantity}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Outputs */}
                    {itemOutputs.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {itemOutputs.map((output: any, idx: number) => {
                          if (output.type === 'ProductImage') {
                            return (
                              <div key={idx}>
                                <img 
                                  src={output.value} 
                                  alt={output.name}
                                  className="w-48 h-48 object-contain rounded border"
                                />
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{output.name}:</span>{' '}
                              <span>{output.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Prompts */}
                    {itemPrompts.length > 0 && (
                      <div className="space-y-1 pl-2 border-l-2 border-muted">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Detalles</p>
                        {itemPrompts.map((prompt: any, idx: number) => {
                          const label = prompt.label || '';
                          const value = prompt.value || '';
                          
                          // Filtrar URLs e imágenes
                          if (!value || 
                              typeof value === 'object' || 
                              (typeof value === 'string' && (
                                value.startsWith('http') || 
                                value.startsWith('#')
                              ))) {
                            return null;
                          }
                          
                          return (
                            <div key={idx} className="text-sm">
                              <span className="font-medium text-muted-foreground">{label}:</span>{' '}
                              <span className="text-foreground">{value}</span>
                            </div>
                          );
                        }).filter(Boolean)}
                      </div>
                    )}
                  </div>
                );
              })}

              <Separator className="my-4" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">{order.subtotal.toFixed(2)} €</span>
                </div>

                {/* Additionals */}
                {additionals.map((additional) => (
                  <div key={additional.id} className="flex justify-between text-sm">
                    <span className={additional.is_discount ? "text-green-600" : "text-muted-foreground"}>
                      {additional.name}:
                    </span>
                    <span className={additional.is_discount ? "text-green-600 font-medium" : "font-medium"}>
                      {additional.is_discount && "-"}
                      {additional.type === 'percentage' ? `${additional.value}%` : `${additional.value.toFixed(2)} €`}
                    </span>
                  </div>
                ))}

                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Descuento:</span>
                    <span className="text-green-600 font-medium">-{order.discount_amount.toFixed(2)} €</span>
                  </div>
                )}

                {order.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impuestos:</span>
                    <span className="font-medium">{order.tax_amount.toFixed(2)} €</span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>Total del pedido:</span>
                  <span className="text-primary">{order.final_price.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay artículos en este pedido
            </div>
          )}
        </CardContent>
      </Card>

      <EditOrderItemDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        item={editingItem}
        onSave={handleSaveItemEdit}
        saving={loading}
      />
    </div>
  );
};

export default SalesOrderDetail;
