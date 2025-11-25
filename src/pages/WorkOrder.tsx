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
    <div className="min-h-screen bg-muted/30">
      {/* Header - Only visible on screen, not in print */}
      <div className="sticky top-0 z-10 bg-background border-b print:hidden">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/pedidos/${id}`)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  Orden de Trabajo - {order.order_number}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {items.length} artículo{items.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              {isGeneratingPDF ? 'Generando PDF...' : 'Descargar PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* Work Order Items */}
      <div className="space-y-8 py-8">
        {items.map((item, index) => (
          <WorkOrderItem
            key={item.id}
            item={item}
            orderNumber={order.order_number}
            customerName={customerName}
            orderDate={formattedOrderDate}
            deliveryDate={formattedDeliveryDate}
            itemIndex={index}
          />
        ))}
      </div>
    </div>
  );
};

export default WorkOrder;
