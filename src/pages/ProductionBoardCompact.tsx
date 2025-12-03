import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CustomerName } from "@/components/quotes/CustomerName";
import { format, differenceInDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { LayoutGrid, List, ChevronDown, ChevronRight, Check, Edit } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";
import { useProductionBoardView } from "@/hooks/useProductionBoardView";
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
  in_progress: "En proceso",
  completed: "Completado"
};
const getDeadlineColor = (deliveryDate: string | null): string => {
  if (!deliveryDate) return "bg-slate-200";
  const today = startOfDay(new Date());
  const delivery = startOfDay(new Date(deliveryDate));
  const daysUntil = differenceInDays(delivery, today);
  if (daysUntil < 0) return "bg-red-500";
  if (daysUntil === 0) return "bg-orange-500";
  if (daysUntil === 1) return "bg-yellow-500";
  return "bg-green-500";
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
export default function ProductionBoardCompact() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const {
    view,
    updateView
  } = useProductionBoardView();
  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };
  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Filtrar por organization_id para separar datos por tenant
      const organizationId = sessionStorage.getItem('selected_organization_id');
      
      let query = supabase
        .from("sales_orders")
        .select("*")
        .in("status", ["pending", "in_production"])
        .order("delivery_date", {
          ascending: true,
          nullsFirst: false
        });
      
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      
      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) throw ordersError;
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
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold mb-4">Panel de producción - Compacta</h1>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button variant={view === 'list' ? 'default' : 'outline'} onClick={() => {
          updateView('list');
          navigate("/panel-produccion-lista");
        }} size="sm" className="gap-2">
            {view === 'list' && <Check className="h-4 w-4" />}
            <span className="hidden sm:inline">Vista Lista</span>
            <span className="sm:hidden">Lista</span>
          </Button>
          <Button variant={view === 'compact' ? 'default' : 'outline'} onClick={() => {
          updateView('compact');
          navigate("/panel-produccion-compacta");
        }} size="sm" className="gap-2">
            {view === 'compact' && <Check className="h-4 w-4" />}
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Vista Compacta</span>
            <span className="sm:hidden">Compacta</span>
          </Button>
          <Button variant={view === 'kanban' ? 'default' : 'outline'} onClick={() => {
          updateView('kanban');
          navigate("/panel-produccion-tablero");
        }} size="sm" className="gap-2">
            {view === 'kanban' && <Check className="h-4 w-4" />}
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Vista Tablero</span>
            <span className="sm:hidden">Tablero</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-full mx-auto">
        {orders.length === 0 ? <Card className="p-12 col-span-full">
            <div className="text-center text-2xl text-muted-foreground">No hay pedidos en producción</div>
          </Card> : orders.map(order => {
        const deadlineColor = getDeadlineColor(order.delivery_date);
        const deadlineLabel = getDeadlineLabel(order.delivery_date);
        return <Card key={order.id} className={`border-4 ${deadlineColor} shadow-lg`}>
                <CardContent className="p-3">
                  {/* Deadline Status */}
                  <div className={`${deadlineColor} text-white rounded px-3 py-2 text-center font-bold mb-3`}>
                    <div className="text-base mb-1">{deadlineLabel}</div>
                    {order.delivery_date && <div className="text-xs opacity-90">
                        {format(new Date(order.delivery_date), "dd/MM/yyyy", {
                  locale: es
                })}
                      </div>}
                  </div>

                  {/* Order Info */}
                  <div className="space-y-2 mb-3 pb-3 border-b border-border">
                    <div>
                      <div className="text-xs text-secondary">Pedido</div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold">{order.order_number}</div>
                        <Link to={`/pedidos/${order.id}/editar`}>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-secondary">Cliente</div>
                      <div className="text-sm font-semibold">
                        <CustomerName customerId={order.customer_id} />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-secondary">Estado pedido</div>
                      <Badge variant={order.status === "completed" ? "default" : order.status === "in_production" ? "secondary" : "outline"} className="text-xs">
                        {statusLabels[order.status as keyof typeof statusLabels] || order.status}
                      </Badge>
                    </div>

                    <div>
                      <div className="text-xs text-secondary">Fecha pedido</div>
                      <div className="text-xs">{format(new Date(order.order_date), "dd/MM/yyyy", {
                    locale: es
                  })}</div>
                    </div>
                  </div>

                  {/* Items Section */}
                  <div className="space-y-2">
                    <div className="font-semibold text-xs mb-2">Artículos ({order.items.length}):</div>
                    {order.items.map((item, index) => <div key={item.id} className="space-y-1">
                        <div className="flex items-start gap-2">
                          <button onClick={() => toggleItemExpanded(item.id)} className="hover:bg-muted rounded p-0.5 transition-colors mt-0.5">
                            {expandedItems.has(item.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs break-words">
                              {index + 1}. {item.product_name}
                            </div>
                            <Badge variant={item.production_status === "completed" ? "default" : item.production_status === "in_progress" ? "secondary" : "outline"} className="text-xs mt-1">
                              Estado: {itemStatusLabels[item.production_status as keyof typeof itemStatusLabels] || "Pendiente"}
                            </Badge>
                          </div>
                        </div>

                        {expandedItems.has(item.id) && item.prompts && Array.isArray(item.prompts) && item.prompts.length > 0 && <div className="text-xs pl-5 space-y-0.5 text-muted-foreground">
                              {(item.prompts as Array<{
                    label: string;
                    value: string;
                    order: number;
                  }>).sort((a, b) => a.order - b.order).map((prompt, pIdx) => <div key={pIdx} className="flex gap-1 text-muted">
                                    <span className="font-medium">{prompt.label}:</span>
                                    <span className="break-words">{prompt.value}</span>
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