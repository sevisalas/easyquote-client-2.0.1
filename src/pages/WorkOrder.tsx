import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useSalesOrders } from "@/hooks/useSalesOrders";
import { WorkOrderItem } from "@/components/production/WorkOrderItem";
import { generateWorkOrderPDF } from "@/utils/workOrderGenerator";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const WorkOrder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canAccessProduccion } = useSubscription();
  const { loading, fetchSalesOrderById, fetchSalesOrderItems } = useSalesOrders();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!canAccessProduccion()) {
      navigate("/");
      return;
    }
    if (id) {
      loadWorkOrderData();
    }
  }, [id, canAccessProduccion, navigate]);

  const loadWorkOrderData = async () => {
    if (!id) return;
    
    const orderData = await fetchSalesOrderById(id);
    setOrder(orderData);
    
    if (orderData) {
      const itemsData = await fetchSalesOrderItems(id);
      setItems(itemsData);
      
      // Load customer name
      if (orderData.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name')
          .eq('id', orderData.customer_id)
          .maybeSingle();
        
        if (customer) {
          setCustomerName(customer.name);
        }
      }
    }
  };

  const handleGeneratePDF = async () => {
    if (!order || !id) return;
    
    setIsGeneratingPDF(true);
    try {
      await generateWorkOrderPDF({
        orderId: id,
        orderNumber: order.order_number,
        customerName,
        orderDate: order.order_date,
        deliveryDate: order.delivery_date,
        items: items,
        filename: `OT-${order.order_number}.pdf`
      });
      toast.success("PDF de Orden de Trabajo generado correctamente");
    } catch (error) {
      console.error('Error generating work order PDF:', error);
      toast.error("Error al generar el PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const formattedOrderDate = order.order_date 
    ? format(new Date(order.order_date), "dd 'de' MMMM 'de' yyyy", { locale: es })
    : undefined;

  const formattedDeliveryDate = order.delivery_date
    ? format(new Date(order.delivery_date), "dd 'de' MMMM 'de' yyyy", { locale: es })
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Only visible on screen, not in print */}
      <div className="sticky top-0 z-10 bg-background border-b print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/pedidos/${id}`)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  Orden de Trabajo #{order.order_number}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {customerName && `${customerName} • `}
                  {items.length} artículo{items.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Order Info */}
      <div className="container mx-auto px-4 py-6 space-y-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {customerName && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Cliente</label>
              <p className="text-lg font-semibold mt-1">{customerName}</p>
            </div>
          )}
          {formattedOrderDate && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fecha Pedido</label>
              <p className="text-lg font-semibold mt-1">{formattedOrderDate}</p>
            </div>
          )}
          {formattedDeliveryDate && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fecha Entrega</label>
              <p className="text-lg font-semibold mt-1">{formattedDeliveryDate}</p>
            </div>
          )}
        </div>
      </div>

      {/* Work Order Items - Screen View */}
      <div className="container mx-auto px-4 pb-6 space-y-3 print:hidden">
        {items.map((item, index) => (
          <Collapsible key={item.id} className="border rounded-lg">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <ChevronDown className="h-5 w-5 transition-transform [[data-state=open]_&]:rotate-180" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">#{order.order_number}-{index + 1}</span>
                      <Badge variant="outline">{item.product_name}</Badge>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Cantidad: {item.quantity}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <WorkOrderItem
                item={item}
                orderNumber={order.order_number}
                customerName={customerName}
                orderDate={formattedOrderDate}
                deliveryDate={formattedDeliveryDate}
                itemIndex={index}
              />
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* PDF Print View - Hidden on screen */}
      <div className="hidden print:block">
        {items.map((item, index) => (
          <div key={item.id} className="page-break">
            <WorkOrderItem
              item={item}
              orderNumber={order.order_number}
              customerName={customerName}
              orderDate={formattedOrderDate}
              deliveryDate={formattedDeliveryDate}
              itemIndex={index}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkOrder;
