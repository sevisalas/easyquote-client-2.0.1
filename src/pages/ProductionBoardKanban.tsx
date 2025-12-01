import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CustomerName } from "@/components/quotes/CustomerName";
import { format, differenceInDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { List, ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
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

const itemStatusLabels = {
  pending: "Pendiente",
  in_production: "En producción",
  completed: "Completado"
};

const getDeadlineCategory = (deliveryDate: string | null): string => {
  if (!deliveryDate) return "no-date";
  const today = startOfDay(new Date());
  const delivery = startOfDay(new Date(deliveryDate));
  const daysUntil = differenceInDays(delivery, today);
  
  if (daysUntil < 0) return "overdue"; // Fuera de plazo
  if (daysUntil === 0) return "today"; // Entrega hoy
  if (daysUntil === 1) return "tomorrow"; // Entrega mañana
  return "on-time"; // En plazo
};

export default function ProductionBoardKanban() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

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

    // Auto-refresh every 5 minutes
    const interval = setInterval(loadOrders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const {
        data: ordersData,
        error: ordersError
      } = await supabase
        .from("sales_orders")
        .select("*")
        .in("status", ["pending", "in_production"])
        .order("delivery_date", { ascending: true, nullsFirst: false });

      if (ordersError) throw ordersError;

      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: items, error: itemsError } = await supabase
            .from("sales_order_items")
            .select("*")
            .eq("sales_order_id", order.id)
            .order("position");

          if (itemsError) throw itemsError;

          return {
            ...order,
            items: items || []
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const categorizedOrders = {
    overdue: orders.filter((o) => getDeadlineCategory(o.delivery_date) === "overdue"),
    today: orders.filter((o) => getDeadlineCategory(o.delivery_date) === "today"),
    tomorrow: orders.filter((o) => getDeadlineCategory(o.delivery_date) === "tomorrow"),
    "on-time": orders.filter((o) => getDeadlineCategory(o.delivery_date) === "on-time")
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-semibold text-muted-foreground">
          Cargando pedidos...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-4xl font-bold">Panel de producción - Tablero</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/panel-produccion")} className="gap-2">
            <List className="h-4 w-4" />
            Vista lista
          </Button>
          <Button variant="outline" onClick={() => navigate("/panel-produccion-compacta")} className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Vista compacta
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Columna: Fuera de plazo */}
        <div className="flex-shrink-0 w-96 bg-muted/30 rounded-lg p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <h2 className="text-lg font-bold">Fuera de plazo</h2>
            <Badge variant="secondary" className="ml-auto">
              {categorizedOrders.overdue.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {categorizedOrders.overdue.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-lg">{order.order_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(order.delivery_date!), "dd/MM", { locale: es })}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">
                      <CustomerName customerId={order.customer_id} />
                    </div>
                    <div className="text-xs space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={item.id} className="space-y-1 pb-2 border-b last:border-b-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleItemExpanded(item.id)}
                              className="hover:bg-muted rounded p-0.5 transition-colors"
                            >
                              {expandedItems.has(item.id) ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                            <span className="font-medium">{idx + 1}. {item.product_name}</span>
                            <Badge 
                              variant={
                                item.production_status === "completed" 
                                  ? "default" 
                                  : item.production_status === "in_production" 
                                  ? "secondary" 
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {itemStatusLabels[item.production_status as keyof typeof itemStatusLabels] || "Pendiente"}
                            </Badge>
                          </div>
                          {expandedItems.has(item.id) && item.prompts && Array.isArray(item.prompts) && item.prompts.length > 0 && (
                            <div className="text-xs text-muted-foreground pl-4 space-y-0.5">
                              {(item.prompts as Array<{ label: string; value: string; order: number }>)
                                .sort((a, b) => a.order - b.order)
                                .map((prompt, pIdx) => (
                                  <div key={pIdx} className="flex gap-1">
                                    <span className="font-medium">{prompt.label}:</span>
                                    <span>{prompt.value}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Columna: Entrega hoy */}
        <div className="flex-shrink-0 w-96 bg-muted/30 rounded-lg p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <h2 className="text-lg font-bold">Entrega hoy</h2>
            <Badge variant="secondary" className="ml-auto">
              {categorizedOrders.today.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {categorizedOrders.today.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-lg">{order.order_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(order.delivery_date!), "dd/MM", { locale: es })}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">
                      <CustomerName customerId={order.customer_id} />
                    </div>
                    <div className="text-xs space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={item.id} className="space-y-1 pb-2 border-b last:border-b-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleItemExpanded(item.id)}
                              className="hover:bg-muted rounded p-0.5 transition-colors"
                            >
                              {expandedItems.has(item.id) ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                            <span className="font-medium">{idx + 1}. {item.product_name}</span>
                            <Badge 
                              variant={
                                item.production_status === "completed" 
                                  ? "default" 
                                  : item.production_status === "in_production" 
                                  ? "secondary" 
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {itemStatusLabels[item.production_status as keyof typeof itemStatusLabels] || "Pendiente"}
                            </Badge>
                          </div>
                          {expandedItems.has(item.id) && item.prompts && Array.isArray(item.prompts) && item.prompts.length > 0 && (
                            <div className="text-xs text-muted-foreground pl-4 space-y-0.5">
                              {(item.prompts as Array<{ label: string; value: string; order: number }>)
                                .sort((a, b) => a.order - b.order)
                                .map((prompt, pIdx) => (
                                  <div key={pIdx} className="flex gap-1">
                                    <span className="font-medium">{prompt.label}:</span>
                                    <span>{prompt.value}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Columna: Entrega mañana */}
        <div className="flex-shrink-0 w-96 bg-muted/30 rounded-lg p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <h2 className="text-lg font-bold">Entrega mañana</h2>
            <Badge variant="secondary" className="ml-auto">
              {categorizedOrders.tomorrow.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {categorizedOrders.tomorrow.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-yellow-500 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-lg">{order.order_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(order.delivery_date!), "dd/MM", { locale: es })}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">
                      <CustomerName customerId={order.customer_id} />
                    </div>
                    <div className="text-xs space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={item.id} className="space-y-1 pb-2 border-b last:border-b-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleItemExpanded(item.id)}
                              className="hover:bg-muted rounded p-0.5 transition-colors"
                            >
                              {expandedItems.has(item.id) ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                            <span className="font-medium">{idx + 1}. {item.product_name}</span>
                            <Badge 
                              variant={
                                item.production_status === "completed" 
                                  ? "default" 
                                  : item.production_status === "in_production" 
                                  ? "secondary" 
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {itemStatusLabels[item.production_status as keyof typeof itemStatusLabels] || "Pendiente"}
                            </Badge>
                          </div>
                          {expandedItems.has(item.id) && item.prompts && Array.isArray(item.prompts) && item.prompts.length > 0 && (
                            <div className="text-xs text-muted-foreground pl-4 space-y-0.5">
                              {(item.prompts as Array<{ label: string; value: string; order: number }>)
                                .sort((a, b) => a.order - b.order)
                                .map((prompt, pIdx) => (
                                  <div key={pIdx} className="flex gap-1">
                                    <span className="font-medium">{prompt.label}:</span>
                                    <span>{prompt.value}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Columna: En plazo */}
        <div className="flex-shrink-0 w-96 bg-muted/30 rounded-lg p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <h2 className="text-lg font-bold">En plazo</h2>
            <Badge variant="secondary" className="ml-auto">
              {categorizedOrders["on-time"].length}
            </Badge>
          </div>
          <div className="space-y-3">
            {categorizedOrders["on-time"].map((order) => (
              <Card key={order.id} className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-lg">{order.order_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(order.delivery_date!), "dd/MM", { locale: es })}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">
                      <CustomerName customerId={order.customer_id} />
                    </div>
                    <div className="text-xs space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={item.id} className="space-y-1 pb-2 border-b last:border-b-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleItemExpanded(item.id)}
                              className="hover:bg-muted rounded p-0.5 transition-colors"
                            >
                              {expandedItems.has(item.id) ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                            <span className="font-medium">{idx + 1}. {item.product_name}</span>
                            <Badge 
                              variant={
                                item.production_status === "completed" 
                                  ? "default" 
                                  : item.production_status === "in_production" 
                                  ? "secondary" 
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {itemStatusLabels[item.production_status as keyof typeof itemStatusLabels] || "Pendiente"}
                            </Badge>
                          </div>
                          {expandedItems.has(item.id) && item.prompts && Array.isArray(item.prompts) && item.prompts.length > 0 && (
                            <div className="text-xs text-muted-foreground pl-4 space-y-0.5">
                              {(item.prompts as Array<{ label: string; value: string; order: number }>)
                                .sort((a, b) => a.order - b.order)
                                .map((prompt, pIdx) => (
                                  <div key={pIdx} className="flex gap-1">
                                    <span className="font-medium">{prompt.label}:</span>
                                    <span>{prompt.value}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
