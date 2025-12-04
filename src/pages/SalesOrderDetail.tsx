import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Download, ChevronDown, Edit, FileText, LayoutGrid, Wrench } from "lucide-react";
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
import { isVisiblePrompt, type PromptDef } from "@/utils/promptVisibility";
import { ItemProductionCard } from "@/components/production/ItemProductionCard";
import { WorkOrderItem } from "@/components/production/WorkOrderItem";
import { generateWorkOrderPDF } from "@/utils/workOrderPdfGenerator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const { canAccessProduccion } = useSubscription();
  const { loading, fetchSalesOrderById, fetchSalesOrderItems, fetchSalesOrderAdditionals, updateSalesOrderStatus, deleteSalesOrder } = useSalesOrders();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [additionals, setAdditionals] = useState<SalesOrderAdditional[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [viewMode, setViewMode] = useState<'production' | 'administrative'>('production');
  const [userRole, setUserRole] = useState<string | null>(null);
  const { isHoldedActive } = useHoldedIntegration();

  useEffect(() => {
    if (!canAccessProduccion()) {
      navigate("/");
      return;
    }
    loadUserRole();
    if (id) {
      loadOrderData();
    }
  }, [id, canAccessProduccion, navigate]);

  const loadUserRole = async () => {
    const { data: roleData } = await supabase.rpc('get_current_user_role').single();
    if (roleData) {
      setUserRole(roleData.role);
      // Comercial solo ve vista administrativa
      if (roleData.role === 'comercial') {
        setViewMode('administrative');
      }
    }
  };

  const loadOrderData = async () => {
    if (!id) return;
    const orderData = await fetchSalesOrderById(id);
    setOrder(orderData);
    
    if (orderData) {
      const itemsData = await fetchSalesOrderItems(id);
      setItems(itemsData);
      
      const additionalsData = await fetchSalesOrderAdditionals(id);
      setAdditionals(additionalsData);
      
      // Auto-sync Holded number if missing
      if (orderData.holded_document_id && !orderData.holded_document_number) {
        syncOrderNumber();
      }
    }
  };

  const syncOrderNumber = async () => {
    if (!id || !order?.holded_document_id) return;
    
    setIsSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-sync-order-number',
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
        throw new Error(result.error || 'Error al sincronizar');
      }

      if (result.holdedNumber) {
        setOrder(prev => prev ? { ...prev, holded_document_number: result.holdedNumber } : null);
        toast.success('Número de Holded sincronizado');
      }
    } catch (error: any) {
      console.error('Error syncing order number:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusChange = async (newStatus: SalesOrder['status']) => {
    if (!id || !order) return;
    
    // Validar que todos los artículos estén completados antes de marcar el pedido como completado
    if (newStatus === 'completed') {
      const incompleteItems = items.filter(item => item.production_status !== 'completed');
      if (incompleteItems.length > 0) {
        toast.error(`No se puede completar el pedido. Hay ${incompleteItems.length} artículo(s) sin terminar.`);
        return;
      }
    }
    
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
    if (!order.customer_id) {
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

      const organizationId = sessionStorage.getItem('selected_organization_id');
      
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
            documentType: 'salesorder',
            organization_id: organizationId
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

  const handleSyncHoldedNumber = async () => {
    if (!id || !order?.holded_document_id) {
      toast.error('No se puede sincronizar este pedido');
      return;
    }

    try {
      setIsSyncing(true);
      toast.loading('Sincronizando número de Holded...');

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('No hay sesión activa');
        return;
      }

      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-sync-order-number',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ orderId: id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al sincronizar');
      }

      setOrder(prev => prev ? { ...prev, holded_document_number: data.holdedNumber } : null);
      toast.success(`Número sincronizado: ${data.holdedNumber}`);
    } catch (error: any) {
      console.error('Error syncing Holded number:', error);
      toast.error(error.message || 'Error al sincronizar el número de Holded');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!order || items.length === 0) return;

    setIsGeneratingPDF(true);
    try {
      // Get customer name
      let customerName = 'Sin cliente';
      if (order.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name')
          .eq('id', order.customer_id)
          .single();
        if (customer) customerName = customer.name;
      }

      await generateWorkOrderPDF({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName,
        orderDate: format(new Date(order.order_date), 'dd/MM/yyyy', { locale: es }),
        deliveryDate: order.delivery_date 
          ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
          : undefined,
        items: items.map((item, index) => ({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          prompts: item.prompts as any,
          outputs: item.outputs as any,
          description: item.description || undefined,
          imposition_data: item.imposition_data as any,
        })),
      });
      
      toast.success('PDF de Orden de Trabajo generado correctamente');
    } catch (error) {
      console.error('Error generating work order PDF:', error);
      toast.error('Error al generar el PDF de Orden de Trabajo');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!canAccessProduccion()) {
    return null;
  }

  if (loading || !order) {
    return (
      <div className={isMobile ? "p-3" : "container mx-auto py-6"}>
        <div className="text-center py-8">Cargando pedido...</div>
      </div>
    );
  }

  return (
    <div className={isMobile ? "p-0 md:p-2 space-y-3" : "container mx-auto py-2 space-y-3"}>
      {/* Header */}
      <Card className={isMobile ? "rounded-none" : ""}>
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3`}>
            <div className="flex items-center gap-3 flex-1">
              <div>
                <CardTitle className={isMobile ? "text-base" : "text-lg"}>
                  Pedido {order.order_number}
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Fecha: {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: es })}
                </CardDescription>
              </div>
              
              {/* Toggle de vistas - oculto para comerciales */}
              {userRole !== 'comercial' && !isMobile && (
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'production' | 'administrative')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="production" className="gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Producción</span>
                    </TabsTrigger>
                    <TabsTrigger value="administrative" className="gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Admin</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            
            {/* Botones de acción - grid en móvil */}
            <div className={`flex ${isMobile ? 'flex-wrap' : ''} gap-2`}>
              <Button 
                onClick={() => navigate("/pedidos")}
                size={isMobile ? "default" : "sm"}
                variant="outline"
                className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
              >
                <ArrowLeft className="h-4 w-4" />
                {!isMobile && "Volver"}
              </Button>
              {order.holded_document_id && viewMode === 'administrative' && (
                <Button 
                  onClick={handleDownloadHoldedPdf}
                  size={isMobile ? "default" : "sm"}
                  variant="outline"
                  className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                >
                  <Download className="h-4 w-4" />
                  {!isMobile && "PDF Holded"}
                </Button>
              )}
              {viewMode === 'production' && (
                <Button 
                  onClick={handleGeneratePDF}
                  size={isMobile ? "default" : "sm"}
                  variant="outline"
                  className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                  disabled={isGeneratingPDF}
                >
                  <Download className="h-4 w-4" />
                  {!isMobile && "Descargar OT PDF"}
                </Button>
              )}
              {order.status === 'draft' && (
                <Button 
                  onClick={() => navigate(`/pedidos/${id}/editar`)}
                  size={isMobile ? "default" : "sm"}
                  variant="outline"
                  className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                >
                  <Edit className="h-4 w-4" />
                  {!isMobile && "Editar"}
                </Button>
              )}
              {order.status === 'draft' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size={isMobile ? "default" : "sm"} 
                      variant="destructive" 
                      className={`gap-2 ${isMobile ? 'h-10 px-3' : ''}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      {!isMobile && "Eliminar"}
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
            
            {/* Toggle móvil de vistas - solo visible en móvil */}
            {userRole !== 'comercial' && isMobile && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'production' | 'administrative')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-11">
                  <TabsTrigger value="production" className="gap-2">
                    <Wrench className="h-4 w-4" />
                    Producción
                  </TabsTrigger>
                  <TabsTrigger value="administrative" className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Admin
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          </div>
        </CardHeader>
      </Card>

      {/* Información del Pedido */}
      <Card className={isMobile ? "rounded-none" : ""}>
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <CardTitle className="text-base">Información del pedido</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? "p-3 pt-2 space-y-2" : "space-y-2"}>
          {viewMode === 'administrative' ? (
            /* Vista Administrativa - Con precios y detalles comerciales */
            <>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 md:grid-cols-4 gap-2'}`}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">cliente</label>
                  <p className="text-sm font-medium mt-0.5">
                    <CustomerName 
                      customerId={order.customer_id} 
                      fallback="No asignado" 
                    />
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">estado</label>
                  <div className="mt-0.5">
                    <Select value={order.status} onValueChange={handleStatusChange} disabled={isExporting}>
                      <SelectTrigger className={isMobile ? "h-11 text-sm" : "h-7 text-xs"}>
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
            </>
          ) : (
            /* Vista Producción - Sin precios */
            <>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 md:grid-cols-3 gap-2'}`}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">cliente</label>
                  <p className="text-sm font-medium mt-0.5">
                    <CustomerName 
                      customerId={order.customer_id} 
                      fallback="No asignado" 
                    />
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">estado</label>
                  <div className="mt-0.5">
                    <Select value={order.status} onValueChange={handleStatusChange} disabled={isExporting}>
                      <SelectTrigger className={isMobile ? "h-11 text-sm" : "h-7 text-xs"}>
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
                  <label className="text-xs font-medium text-muted-foreground">entrega</label>
                  <p className="text-sm mt-0.5">
                    {order.delivery_date 
                      ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
                      : 'No especificado'
                    }
                  </p>
                </div>
              </div>
            </>
          )}
          
          {/* Descripción y notas */}
          {(order.description || order.notes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
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
          
          {/* Barra de estados del pedido */}
          <div className="pt-3">
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-2 rounded-full transition-all ${
                order.status === 'draft' || order.status === 'pending' || order.status === 'in_production' || order.status === 'completed' ? 'bg-slate-400' : 'bg-muted'
              }`} title="Borrador" />
              <div className={`flex-1 h-2 rounded-full transition-all ${
                order.status === 'pending' || order.status === 'in_production' || order.status === 'completed' ? 'bg-orange-500' : 'bg-muted'
              }`} title="Pendiente" />
              <div className={`flex-1 h-2 rounded-full transition-all ${
                order.status === 'in_production' || order.status === 'completed' ? 'bg-green-500' : 'bg-muted'
              }`} title="En producción" />
              <div className={`flex-1 h-2 rounded-full transition-all ${
                order.status === 'completed' ? 'bg-blue-500' : 'bg-muted'
              }`} title="Terminado" />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
              <span>Borrador</span>
              <span>Pendiente</span>
              <span>En producción</span>
              <span>Terminado</span>
            </div>
          </div>

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
      <Card className={isMobile ? "rounded-none" : ""}>
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <CardTitle className="text-base">Artículos del pedido</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? "p-3 pt-0" : "pt-0"}>
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
                    defaultOpen={false}
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
                      <CollapsibleTrigger className={`w-full hover:bg-muted/50 transition-colors ${isMobile ? 'p-3' : 'p-4'}`}>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-3 flex-1 text-left min-w-0">
                            <ChevronDown
                              className={`h-5 w-5 transition-transform flex-shrink-0 ${
                                isExpanded ? "transform rotate-180" : ""
                              }`}
                            />
                            <h3 className={`font-semibold truncate ${isMobile ? 'text-base' : 'text-lg'}`}>{item.description || item.product_name}</h3>
                            {/* Mini barra de estados del artículo - oculta en móvil */}
                            {!isMobile && (
                              <div className="flex items-center gap-1 ml-3">
                                <div className={`w-5 h-1.5 rounded-full transition-all ${
                                  ['pending', 'in_progress', 'completed'].includes(item.production_status || '') ? 'bg-orange-500' : 'bg-muted'
                                }`} title="Pendiente" />
                                <div className={`w-5 h-1.5 rounded-full transition-all ${
                                  ['in_progress', 'completed'].includes(item.production_status || '') ? 'bg-green-500' : 'bg-muted'
                                }`} title="En proceso" />
                                <div className={`w-5 h-1.5 rounded-full transition-all ${
                                  item.production_status === 'completed' ? 'bg-blue-500' : 'bg-muted'
                                }`} title="Completado" />
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            {viewMode === 'administrative' && (
                              <p className={`font-bold text-primary ${isMobile ? 'text-lg' : 'text-xl'}`}>{item.price.toFixed(2)} €</p>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className={`space-y-4 ${isMobile ? 'px-3 pb-3 pt-2' : 'px-4 pb-4 pt-2'}`}>
                          <WorkOrderItem
                            item={{
                              id: item.id,
                              product_name: item.product_name,
                              quantity: item.quantity,
                              prompts: itemPrompts,
                              outputs: itemOutputs,
                              description: item.description || undefined,
                            }}
                            orderNumber={order.order_number}
                            customerName={order.customer_id ? undefined : 'Sin cliente'}
                            orderDate={format(new Date(order.order_date), 'dd/MM/yyyy', { locale: es })}
                            deliveryDate={order.delivery_date 
                              ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
                              : undefined
                            }
                            itemIndex={index}
                          />
                          
                          {/* Gestión de Producción integrada - Solo en vista producción */}
                          {order.status === 'in_production' && viewMode === 'production' && (
                            <div className="pt-2 border-t">
                              <ItemProductionCard item={item} onStatusUpdate={loadOrderData} />
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}

              {/* Ajustes - Visible en ambas vistas */}
              {additionals.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Ajustes del pedido</h4>
                    {additionals.map((additional) => {
                      const cleanName = additional.name
                        .replace(/\s*Ajuste sobre el presupuesto\s*/gi, '')
                        .replace(/\s*Ajuste sobre el pedido\s*/gi, '')
                        .trim();
                      
                      return (
                        <div key={additional.id} className="flex justify-between text-sm">
                          <span className={additional.is_discount ? "text-green-600" : "text-muted-foreground"}>
                            {cleanName}:
                          </span>
                          <span className={additional.is_discount ? "text-green-600 font-medium" : "font-medium"}>
                            {additional.is_discount && "-"}
                            {additional.type === 'percentage' ? `${additional.value}%` : fmtEUR(additional.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Totals - Solo en vista administrativa */}
              {viewMode === 'administrative' && (
                <>
                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-base">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{fmtEUR(order.subtotal)}</span>
                    </div>

                    {order.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Descuento:</span>
                        <span className="text-green-600 font-medium">-{fmtEUR(order.discount_amount)}</span>
                      </div>
                    )}

                    <Separator className="my-2" />

                    <div className="flex justify-between text-xl font-bold pt-2">
                      <span>Total del pedido:</span>
                      <span className="text-primary">{fmtEUR(order.final_price)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de Producción eliminado - ahora integrado en cada artículo */}
    </div>
  );
};

export default SalesOrderDetail;
