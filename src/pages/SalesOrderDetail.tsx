import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Calendar, Trash2, Upload, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useSalesOrders, SalesOrder, SalesOrderItem, SalesOrderAdditional } from "@/hooks/useSalesOrders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";

const statusColors = {
  draft: "outline",
  pending: "default",
  in_production: "secondary",
  completed: "default",
  cancelled: "destructive",
} as const;

const statusLabels = {
  draft: "Borrador",
  pending: "Pendiente",
  in_production: "En Producción",
  completed: "Completado",
  cancelled: "Cancelado",
};

const SalesOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canAccessProduccion } = useSubscription();
  const { loading, fetchSalesOrderById, fetchSalesOrderItems, fetchSalesOrderAdditionals, updateSalesOrderStatus, deleteSalesOrder } = useSalesOrders();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [additionals, setAdditionals] = useState<SalesOrderAdditional[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { isHoldedActive } = useHoldedIntegration();

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
    if (!id || !order) return;
    
    // If changing to pending, export to Holded automatically if integration is active
    if (newStatus === 'pending' && order.status !== 'pending' && isHoldedActive && !order.holded_document_id) {
      const success = await updateSalesOrderStatus(id, newStatus);
      if (success) {
        setOrder(prev => prev ? { ...prev, status: newStatus } : null);
        // Automatically export to Holded
        await handleExportToHolded();
      }
    } else {
      const success = await updateSalesOrderStatus(id, newStatus);
      if (success) {
        setOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const success = await deleteSalesOrder(id);
    if (success) {
      navigate("/pedidos");
    }
  };

  const handleExportToHolded = async () => {
    if (!id || !order) return;
    
    setIsExporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('No hay sesión activa');
        return;
      }

      toast.loading('Exportando a Holded...');

      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-export-order',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ orderId: id })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al exportar a Holded');
      }

      toast.success('Pedido exportado a Holded correctamente');
      
      // Reload to get the holded_document_id
      await loadOrderData();
      
      // Automatically download PDF after export
      if (result.holdedId) {
        try {
          toast.loading('Descargando PDF...');
          
          const pdfResponse = await fetch(
            'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-download-pdf',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.session.access_token}`
              },
              body: JSON.stringify({ 
                holdedDocumentId: result.holdedId,
                documentType: 'salesorder'
              })
            }
          );

          if (pdfResponse.ok) {
            const blob = await pdfResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pedido-${result.holdedNumber || order.order_number}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            toast.success('PDF descargado correctamente');
          }
        } catch (pdfError) {
          console.error('Error downloading PDF:', pdfError);
          // Don't show error toast for PDF download failure, export was successful
        }
      }
    } catch (error: any) {
      console.error('Error exporting to Holded:', error);
      toast.error(error.message || 'Error al exportar a Holded');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadHoldedPdf = async () => {
    if (!order?.holded_document_id) return;

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
            holdedDocumentId: order.holded_document_id,
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
      a.download = `pedido-${order.holded_document_number || order.order_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF descargado correctamente');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descargar el PDF');
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
        <Button variant="outline" onClick={() => navigate("/pedidos")}>
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Pedido {order.order_number}
          </h1>
          <p className="text-muted-foreground">Detalle del pedido</p>
        </div>
        <Badge variant={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
        {order.holded_document_id && (
          <Button 
            onClick={handleDownloadHoldedPdf}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            PDF Holded
          </Button>
        )}
        {order.status === 'draft' && (
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
        )}
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
              <Select 
                value={order.status} 
                onValueChange={handleStatusChange} 
                disabled={isExporting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_production">En Producción</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              {order.status === 'draft' && order.created_from_scratch && isHoldedActive && (
                <p className="text-sm text-muted-foreground mt-1">
                  💡 Cambia a "Pendiente" para enviar automáticamente a Holded
                </p>
              )}
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

          {order.holded_document_number && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Número Holded</label>
              <p className="text-base font-mono">{order.holded_document_number}</p>
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
                const isExpanded = expandedItems.has(item.id);
                
                return (
                  <Collapsible
                    key={item.id}
                    open={isExpanded}
                    onOpenChange={() => {
                      const newExpanded = new Set(expandedItems);
                      if (isExpanded) {
                        newExpanded.delete(item.id);
                      } else {
                        newExpanded.add(item.id);
                      }
                      setExpandedItems(newExpanded);
                    }}
                  >
                    <div className="border rounded-lg">
                      <CollapsibleTrigger className="w-full p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3 flex-1 text-left">
                            <ChevronDown
                              className={`h-5 w-5 transition-transform ${
                                isExpanded ? "transform rotate-180" : ""
                              }`}
                            />
                            <h3 className="font-semibold text-lg">{item.description || item.product_name}</h3>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xl font-bold text-primary">{item.price.toFixed(2)} €</p>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2 space-y-3">
                          {/* Outputs */}
                          {itemOutputs.length > 0 && (
                            <div className="space-y-2">
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
                                let value = prompt.value || '';
                                
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
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
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
    </div>
  );
};

export default SalesOrderDetail;
