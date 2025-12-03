import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Package, TrendingUp, AlertTriangle } from "lucide-react";

interface DayWorkload {
  date: Date;
  orders: Array<{
    id: string;
    order_number: string;
    customer_name: string;
    items_count: number;
  }>;
  count: number;
  percentage: number;
}

export default function WorkloadDashboard() {
  const { organization, membership } = useSubscription();
  const [workloadData, setWorkloadData] = useState<DayWorkload[]>([]);
  const [maxDailyOrders, setMaxDailyOrders] = useState<number>(20);
  const [loading, setLoading] = useState(true);

  // Use organization from either owner or member context
  const currentOrg = organization || membership?.organization;

  useEffect(() => {
    if (currentOrg) {
      setMaxDailyOrders(currentOrg.max_daily_orders || 20);
      fetchWorkloadData();
    }
  }, [currentOrg]);

  const fetchWorkloadData = async () => {
    try {
      setLoading(true);
      const today = startOfDay(new Date());
      
      // Calculate 10 business days ahead
      const businessDays: Date[] = [];
      let currentDate = new Date(today);
      
      while (businessDays.length < 10) {
        const dayOfWeek = currentDate.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          businessDays.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
      }
      
      const endDate = addDays(businessDays[businessDays.length - 1], 1);

      // Fetch sales orders with delivery dates in the next 10 business days
      const { data: orders, error } = await supabase
        .from("sales_orders")
        .select(`
          id,
          order_number,
          delivery_date,
          customer_id,
          customers (
            name
          ),
          sales_order_items (
            id
          )
        `)
        .gte("delivery_date", today.toISOString())
        .lt("delivery_date", endDate.toISOString())
        .in("status", ["pending", "in_production"])
        .order("delivery_date", { ascending: true });

      if (error) throw error;

      // Group orders by delivery date (only business days)
      const groupedByDate: Record<string, DayWorkload> = {};
      
      businessDays.forEach((date) => {
        const dateKey = format(date, "yyyy-MM-dd");
        groupedByDate[dateKey] = {
          date,
          orders: [],
          count: 0,
          percentage: 0,
        };
      });

      orders?.forEach((order: any) => {
        const dateKey = format(new Date(order.delivery_date), "yyyy-MM-dd");
        if (groupedByDate[dateKey]) {
          groupedByDate[dateKey].orders.push({
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customers?.name || "Sin cliente",
            items_count: order.sales_order_items?.length || 0,
          });
          groupedByDate[dateKey].count++;
        }
      });

      // Calculate percentages
      Object.values(groupedByDate).forEach((day) => {
        day.percentage = maxDailyOrders > 0 
          ? Math.round((day.count / maxDailyOrders) * 100)
          : 0;
      });

      setWorkloadData(Object.values(groupedByDate));
    } catch (error) {
      console.error("Error fetching workload data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLoadColor = (percentage: number) => {
    if (percentage < 80) return "bg-green-500";
    if (percentage <= 100) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLoadBadgeVariant = (percentage: number): "default" | "secondary" | "destructive" => {
    if (percentage < 80) return "default";
    if (percentage <= 100) return "secondary";
    return "destructive";
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Cargando carga de trabajo...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-3xl font-bold">Carga de trabajo</h1>
        <p className="text-muted-foreground mt-2">
          Distribución de pedidos para los próximos 10 días hábiles (Capacidad: {maxDailyOrders} pedidos/día)
        </p>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto">
        {workloadData.map((day, index) => (
          <Card key={index} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {format(day.date, "EEEE", { locale: es })}
                </CardTitle>
                <Badge variant={getLoadBadgeVariant(day.percentage)}>
                  {day.percentage}%
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {format(day.date, "d 'de' MMMM", { locale: es })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{day.count}</span>
                <span className="text-sm text-muted-foreground">/ {maxDailyOrders}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mb-3">
                <div
                  className={`${getLoadColor(day.percentage)} h-2 rounded-full transition-all`}
                  style={{ width: `${Math.min(day.percentage, 100)}%` }}
                />
              </div>

              {/* Orders list */}
              <div className="space-y-2">
                {day.orders.length > 0 ? (
                  day.orders.slice(0, 3).map((order) => (
                    <div
                      key={order.id}
                      className="text-xs p-2 bg-muted/50 rounded border border-border"
                    >
                      <div className="font-medium truncate">{order.order_number}</div>
                      <div className="text-muted-foreground truncate">{order.customer_name}</div>
                      <div className="text-muted-foreground">{order.items_count} artículos</div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Sin pedidos programados</p>
                )}
                {day.orders.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{day.orders.length - 3} más
                  </p>
                )}
              </div>

              {/* Overload warning */}
              {day.percentage > 100 && (
                <div className="flex items-center gap-1 mt-3 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Sobrecarga</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resumen de carga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total próximos 10 días hábiles</p>
              <p className="text-2xl font-bold">
                {workloadData.reduce((sum, day) => sum + day.count, 0)} pedidos
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Promedio diario</p>
              <p className="text-2xl font-bold">
                {Math.round(workloadData.reduce((sum, day) => sum + day.count, 0) / 10)} pedidos/día
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Días con sobrecarga</p>
              <p className="text-2xl font-bold text-destructive">
                {workloadData.filter((day) => day.percentage > 100).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
