import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { FileText, Package, Users, Plus, PlayCircle, ListChecks } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { cn } from "@/lib/utils";

interface QuickAction {
  icon: any;
  label: string;
  description: string;
  path: string;
  color: string;
  bgColor: string;
}

export function QuickActionsPanel() {
  const navigate = useNavigate();
  const { membership } = useSubscription();
  const userRole = membership?.role || 'admin';

  const getActionsForRole = (): QuickAction[] => {
    switch (userRole) {
      case 'operador':
        return [
          {
            icon: Package,
            label: "Mis tareas",
            description: "Ver tareas asignadas",
            path: "/pedidos",
            color: "text-blue-600",
            bgColor: "bg-blue-50 dark:bg-blue-950/20",
          },
          {
            icon: PlayCircle,
            label: "Pedidos en producción",
            description: "Pedidos activos",
            path: "/pedidos?status=in_progress",
            color: "text-green-600",
            bgColor: "bg-green-50 dark:bg-green-950/20",
          },
        ];
      
      case 'comercial':
        return [
          {
            icon: Plus,
            label: "Nuevo presupuesto",
            description: "Crear presupuesto",
            path: "/presupuestos/nuevo",
            color: "text-secondary",
            bgColor: "bg-secondary/10",
          },
          {
            icon: FileText,
            label: "Mis presupuestos",
            description: "Ver mis presupuestos",
            path: "/presupuestos",
            color: "text-secondary",
            bgColor: "bg-secondary/10",
          },
        ];
      
      case 'gestor':
      case 'admin':
      default:
        return [
          {
            icon: Plus,
            label: "Nuevo presupuesto",
            description: "Crear presupuesto",
            path: "/presupuestos/nuevo",
            color: "text-secondary",
            bgColor: "bg-secondary/10",
          },
          {
            icon: Package,
            label: "Pedidos en producción",
            description: "Ver pedidos activos",
            path: "/pedidos?status=in_progress",
            color: "text-secondary",
            bgColor: "bg-secondary/10",
          },
        ];
    }
  };

  const actions = getActionsForRole();

  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-foreground mb-2 px-1 text-center">
        Accesos directos
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Card
              key={index}
              className={cn(
                "cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-2",
                action.bgColor
              )}
              onClick={() => navigate(action.path)}
            >
              <div className="p-4 flex items-center justify-center">
                <p className={cn("font-semibold text-sm text-center", action.color)}>
                  {action.label}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
