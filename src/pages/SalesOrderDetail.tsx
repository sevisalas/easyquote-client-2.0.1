import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Download, ChevronDown, Edit } from "lucide-react";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CustomerName } from "@/components/quotes/CustomerName";

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

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
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
    
    // Validar que el pedido tenga un cliente asignado
    if (!order.customer_id && !order.holded_contact_id) {
      toast.error('El pedido debe tener un cliente asignado para exportar a Holded');
      return;
    }
    
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
    <div className="container mx-auto py-2 space-y-3">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Pedido {order.order_number}
              </CardTitle>
              <CardDescription className="mt-0.5">
                Fecha: {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: es })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => navigate("/pedidos")}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              {order.holded_document_id && (
                <Button 
                  onClick={handleDownloadHoldedPdf}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  PDF Holded
                </Button>
              )}
              {order.status === 'draft' && (
                <Button 
                  onClick={() => navigate(`/pedidos/${id}/editar`)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
              {order.status === 'draft' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Eliminar
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
          </div>
        </CardHeader>
      </Card>

      {/* Información del Pedido */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Información del pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">cliente</label>
              <p className="text-sm font-medium mt-0.5">
                <CustomerName 
                  customerId={order.customer_id} 
                  holdedContactId={order.holded_contact_id}
                  fallback="No asignado" 
                />
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">estado</label>
              <div className="mt-0.5">
                <Select value={order.status} onValueChange={handleStatusChange} disabled={isExporting}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_production">En Producción</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">total</label>
              <p className="text-base font-semibold mt-0.5">{fmtEUR(order.final_price || 0)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">entrega</label>
              <p className="text-sm mt-0.5">
                {order.delivery_date 
                  ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
                  : 'No especificado'
                }
              </p>
            </div>
          </div>
          
          {/* Número de documento Holded */}
          {isHoldedActive && order.holded_document_number && (
            <div className="pt-2">
              <label className="text-xs font-medium text-muted-foreground">Nº documento Holded</label>
              <p className="text-sm font-mono mt-0.5">{order.holded_document_number}</p>
            </div>
          )}
          
          {(order.title || order.description || order.notes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {order.title && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">título</label>
                  <p className="text-sm mt-0.5">{order.title}</p>
                </div>
              )}
              {order.description && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">descripción</label>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{order.description}</p>
                </div>
              )}
              {order.notes && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">notas</label>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </div>
          )}

          {order.status === 'draft' && order.created_from_scratch && isHoldedActive && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground">
                💡 Cambia a "Pendiente" para enviar automáticamente a Holded
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Artículos del Pedido */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Artículos del pedido</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay artículos en este pedido</p>
          ) : (
            <div className="space-y-2">{items.map((item, index) => {
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
                  <span className="font-medium">{fmtEUR(order.subtotal)}</span>
                </div>

                {/* Additionals */}
                {additionals.map((additional) => (
                  <div key={additional.id} className="flex justify-between text-sm">
                    <span className={additional.is_discount ? "text-green-600" : "text-muted-foreground"}>
                      {additional.name}:
                    </span>
                    <span className={additional.is_discount ? "text-green-600 font-medium" : "font-medium"}>
                      {additional.is_discount && "-"}
                      {additional.type === 'percentage' ? `${additional.value}%` : fmtEUR(additional.value)}
                    </span>
                  </div>
                ))}

                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Descuento:</span>
                    <span className="text-green-600 font-medium">-{fmtEUR(order.discount_amount)}</span>
                  </div>
                )}

                {order.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impuestos:</span>
                    <span className="font-medium">{fmtEUR(order.tax_amount)}</span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>Total del pedido:</span>
                  <span className="text-primary">{fmtEUR(order.final_price)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesOrderDetail;
