import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CustomerName } from "@/components/quotes/CustomerName";
import { format, differenceInDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Package, Calendar, Clock, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";
interface SalesOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  production_status: string | null;
  description: string | null;
  prompts: Json | null;
}
interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date: string | null;
  customer_id: string | null;
  status: string;
  items: SalesOrderItem[];
}
const statusLabels = {
  draft: "Borrador",
  pending: "Pendiente",
  in_production: "En producción",
  completed: "Completado"
};
const itemStatusLabels = {
  pending: "Pendiente",
  in_production: "En producción",
  completed: "Completado"
};
const getDeadlineColor = (deliveryDate: string | null): string => {
  if (!deliveryDate) return "bg-slate-200";
  const today = startOfDay(new Date());
  const delivery = startOfDay(new Date(deliveryDate));
  const daysUntil = differenceInDays(delivery, today);
  if (daysUntil < 0) return "bg-red-500"; // Fuera de plazo
  if (daysUntil === 0) return "bg-orange-500"; // Hoy es el día de entrega
  if (daysUntil === 1) return "bg-yellow-500"; // Falta 1 día
  return "bg-green-500"; // En plazo
};
const getDeadlineLabel = (deliveryDate: string | null): string => {
  if (!deliveryDate) return "Sin fecha";
  const today = startOfDay(new Date());
  const delivery = startOfDay(new Date(deliveryDate));
  const daysUntil = differenceInDays(delivery, today);
  if (daysUntil < 0) return "FUERA DE PLAZO";
  if (daysUntil === 0) return "ENTREGA HOY";
  if (daysUntil === 1) return "ENTREGA MAÑANA";
  return `Entrega ${daysUntil} días`;
};
export default function ProductionBoard() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    loadOrders();

    // Auto-refresh every 5 minutes
    const interval = setInterval(loadOrders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const loadOrders = async () => {
    try {
      setLoading(true);

      // Fetch orders with status pending or in_production
      const {
        data: ordersData,
        error: ordersError
      } = await supabase.from("sales_orders").select("*").in("status", ["pending", "in_production"]).order("delivery_date", {
        ascending: true,
        nullsFirst: false
      });
      if (ordersError) throw ordersError;

      // Fetch items for each order
      const ordersWithItems = await Promise.all((ordersData || []).map(async order => {
        const {
          data: items,
          error: itemsError
        } = await supabase.from("sales_order_items").select("*").eq("sales_order_id", order.id).order("position");
        if (itemsError) throw itemsError;
        return {
          ...order,
          items: items || []
        };
      }));
      setOrders(ordersWithItems);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-semibold text-muted-foreground">Cargando pedidos...</div>
      </div>;
  }
  return <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-4xl font-bold">Panel de producción</h1>
        <Button variant="outline" onClick={() => navigate("/panel-produccion-tablero")} className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          Vista tablero
        </Button>
      </div>

      <div className="space-y-2 max-w-7xl mx-auto">
        {orders.length === 0 ? <Card className="p-12">
            <div className="text-center text-2xl text-muted-foreground">No hay pedidos en producción</div>
          </Card> : orders.map(order => {
        const deadlineColor = getDeadlineColor(order.delivery_date);
        const deadlineLabel = getDeadlineLabel(order.delivery_date);
        return <Card key={order.id} className={`border-4 ${deadlineColor} shadow-lg`}>
                <CardContent className="p-3">
                  {/* Header Section */}
                  <div className="grid grid-cols-4 gap-3 mb-2 pb-2 border-b border-border">
                    {/* Deadline Status */}
                    <div className="flex items-center justify-center">
                      <div className={`${deadlineColor} text-white rounded px-3 py-2 w-full text-center font-bold`}>
                        <div className="text-lg mb-1">{deadlineLabel}</div>
                        {order.delivery_date && <div className="text-sm opacity-90">
                            {format(new Date(order.delivery_date), "dd/MM/yyyy", {
                      locale: es
                    })}
                          </div>}
                      </div>
                    </div>

                    {/* Order Info */}
                    <div className="col-span-3 flex gap-4">
                      <div className="w-[140px]">
                        <div className="text-sm mb-1 text-secondary">Pedido</div>
                        <div className="text-xl font-bold">{order.order_number}</div>
                      </div>

                      <div className="flex-1">
                        <div className="text-sm mb-1 text-secondary">Cliente</div>
                        <div className="text-lg font-semibold">
                          <CustomerName customerId={order.customer_id} />
                        </div>
                      </div>

                      <div className="w-[120px] text-right">
                        <div className="text-sm text-muted-foreground mb-1">Fecha pedido</div>
                        <div className="text-base">
                          {format(new Date(order.order_date), "dd/MM/yyyy", {
                      locale: es
                    })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items Section - Una línea por artículo */}
                  <div className="space-y-2">
                    {order.items.map((item, index) => <div key={item.id} className="space-y-1">
                        <div className="flex items-center gap-3 py-0.5">
                          {index === 0 && <span className="font-semibold text-sm mr-2 min-w-[100px]">
                              Artículos ({order.items.length}):
                            </span>}
                          {index > 0 && <span className="min-w-[100px]"></span>}

                          <span className="font-medium text-base">
                            {index + 1}. {item.product_name}
                          </span>

                          <Badge variant={item.production_status === "completed" ? "default" : item.production_status === "in_production" ? "secondary" : "outline"} className="text-sm">
                            {itemStatusLabels[item.production_status as keyof typeof itemStatusLabels] || "Pendiente"}
                          </Badge>
                        </div>
                        
                        {item.prompts && Array.isArray(item.prompts) && item.prompts.length > 0 && <div className="text-xs pl-[116px] space-y-0.5 text-muted">
                            {(item.prompts as Array<{
                    label: string;
                    value: string;
                    order: number;
                  }>).sort((a, b) => a.order - b.order).map((prompt, pIdx) => <div key={pIdx} className="flex gap-1">
                                  <span className="font-medium">{prompt.label}:</span>
                                  <span>{prompt.value}</span>
                                </div>)}
                          </div>}
                      </div>)}
                  </div>
                </CardContent>
              </Card>;
      })}
      </div>
    </div>;
}