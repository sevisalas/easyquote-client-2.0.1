import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { AlertCircle, Clock, CheckCircle, FileText, Package, Users } from "lucide-react";
import { Link } from "react-router-dom";

interface ActivityItem {
  type: 'quote' | 'order' | 'task' | 'customer';
  title: string;
  description: string;
  link: string;
  icon: any;
}

interface PriorityGroup {
  urgent: ActivityItem[];
  medium: ActivityItem[];
  low: ActivityItem[];
}

export function ActivitySummaryPanel() {
  const { membership } = useSubscription();
  const [activities, setActivities] = useState<PriorityGroup>({
    urgent: [],
    medium: [],
    low: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [membership]);

  const loadActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userRole = membership?.role || 'admin';
      const orgId = membership?.organization_id;

      const urgent: ActivityItem[] = [];
      const medium: ActivityItem[] = [];
      const low: ActivityItem[] = [];

      // Cargar según el rol
      if (userRole === 'operador') {
        // Operador: Solo tareas de producción
        const { data: tasks } = await supabase
          .from('production_tasks')
          .select(`
            id,
            task_name,
            status,
            sales_order_item_id,
            sales_order_items!inner(
              product_name,
              sales_order_id
            )
          `)
          .eq('operator_id', user.id)
          .in('status', ['in_progress', 'paused', 'pending'])
          .order('created_at', { ascending: false })
          .limit(10);

        tasks?.forEach((task: any) => {
          const item: ActivityItem = {
            type: 'task',
            title: task.task_name,
            description: task.sales_order_items.product_name,
            link: `/pedidos/${task.sales_order_items.sales_order_id}`,
            icon: Package,
          };

          if (task.status === 'in_progress' || task.status === 'paused') {
            urgent.push(item);
          } else {
            medium.push(item);
          }
        });
      } else if (userRole === 'comercial') {
        // Comercial: Sus propios presupuestos
        const { data: quotes } = await supabase
          .from('quotes')
          .select('id, quote_number, status, customer_id, customers(name)')
          .eq('user_id', user.id)
          .in('status', ['draft', 'pending'])
          .order('created_at', { ascending: false })
          .limit(5);

        quotes?.forEach((quote: any) => {
          medium.push({
            type: 'quote',
            title: `Presupuesto ${quote.quote_number}`,
            description: quote.customers?.name || 'Sin cliente',
            link: `/presupuestos/${quote.id}`,
            icon: FileText,
          });
        });

      } else {
        // Admin/Gestor: Vista completa
        
        // Pedidos en producción (urgente)
        const { data: ordersInProgress } = await supabase
          .from('sales_orders')
          .select('id, order_number, status, customer_id, customers(name)')
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(5);

        ordersInProgress?.forEach((order: any) => {
          urgent.push({
            type: 'order',
            title: `Pedido ${order.order_number}`,
            description: order.customers?.name || 'Sin cliente',
            link: `/pedidos/${order.id}`,
            icon: Package,
          });
        });

        // Presupuestos en borrador (prioridad media)
        const { data: draftQuotes } = await supabase
          .from('quotes')
          .select('id, quote_number, status, customer_id, customers(name)')
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(5);

        draftQuotes?.forEach((quote: any) => {
          medium.push({
            type: 'quote',
            title: `Presupuesto ${quote.quote_number}`,
            description: quote.customers?.name || 'Sin cliente',
            link: `/presupuestos/${quote.id}`,
            icon: FileText,
          });
        });

        // Clientes nuevos del día (prioridad baja)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: newCustomers } = await supabase
          .from('customers')
          .select('id, name, created_at')
          .gte('created_at', today.toISOString())
          .order('created_at', { ascending: false })
          .limit(3);

        newCustomers?.forEach((customer: any) => {
          low.push({
            type: 'customer',
            title: customer.name,
            description: 'Cliente nuevo',
            link: `/clientes/${customer.id}/editar`,
            icon: Users,
          });
        });
      }

      setActivities({ urgent, medium, low });
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityConfig = (priority: 'urgent' | 'medium' | 'low') => {
    switch (priority) {
      case 'urgent':
        return {
          label: 'Urgente',
          color: 'bg-red-500',
          icon: AlertCircle,
          textColor: 'text-red-600',
        };
      case 'medium':
        return {
          label: 'Pendiente',
          color: 'bg-orange-500',
          icon: Clock,
          textColor: 'text-orange-600',
        };
      case 'low':
        return {
          label: 'Reciente',
          color: 'bg-green-500',
          icon: CheckCircle,
          textColor: 'text-green-600',
        };
    }
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">Cargando actividades...</p>
        </CardContent>
      </Card>
    );
  }

  const totalActivities = activities.urgent.length + activities.medium.length + activities.low.length;

  if (totalActivities === 0) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            ✨ No hay actividades pendientes
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base font-semibold">Resumen de Actividades</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Urgente */}
        {activities.urgent.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-1 h-4 ${getPriorityConfig('urgent').color} rounded`} />
              <span className="text-sm font-medium">{getPriorityConfig('urgent').label}</span>
              <Badge variant="secondary" className="ml-auto">{activities.urgent.length}</Badge>
            </div>
            <div className="space-y-2">
              {activities.urgent.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <Link 
                    key={`urgent-${index}`}
                    to={activity.link}
                    className="block p-3 rounded-lg bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Pendiente */}
        {activities.medium.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-1 h-4 ${getPriorityConfig('medium').color} rounded`} />
              <span className="text-sm font-medium">{getPriorityConfig('medium').label}</span>
              <Badge variant="secondary" className="ml-auto">{activities.medium.length}</Badge>
            </div>
            <div className="space-y-2">
              {activities.medium.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <Link 
                    key={`medium-${index}`}
                    to={activity.link}
                    className="block p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Reciente */}
        {activities.low.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-1 h-4 ${getPriorityConfig('low').color} rounded`} />
              <span className="text-sm font-medium">{getPriorityConfig('low').label}</span>
              <Badge variant="secondary" className="ml-auto">{activities.low.length}</Badge>
            </div>
            <div className="space-y-2">
              {activities.low.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <Link 
                    key={`low-${index}`}
                    to={activity.link}
                    className="block p-3 rounded-lg bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
