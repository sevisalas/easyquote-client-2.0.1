import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProductionTaskForm } from "./ProductionTaskForm";
import { ProductionTaskList } from "./ProductionTaskList";
import { useProductionTasks } from "@/hooks/useProductionTasks";

interface ItemProductionCardProps {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    description?: string | null;
    production_status?: string | null;
  };
}

export function ItemProductionCard({ item }: ItemProductionCardProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const { refetch } = useProductionTasks(item.id);

  const handleTaskCreated = () => {
    setShowTaskForm(false);
    refetch();
  };

  return (
    <div className="space-y-3">
      {/* Compact Product Info */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground">Producto</p>
            <p className="text-sm font-semibold">{item.product_name}</p>
          </div>
          {/* Mini status bar */}
          <div className="flex items-center gap-1">
            <div className={`w-6 h-1.5 rounded-full transition-all ${
              item.production_status === 'pending' || item.production_status === 'in_progress' || item.production_status === 'completed' ? 'bg-orange-500' : 'bg-muted'
            }`} title="Pendiente" />
            <div className={`w-6 h-1.5 rounded-full transition-all ${
              item.production_status === 'in_progress' || item.production_status === 'completed' ? 'bg-green-500' : 'bg-muted'
            }`} title="En proceso" />
            <div className={`w-6 h-1.5 rounded-full transition-all ${
              item.production_status === 'completed' ? 'bg-secondary' : 'bg-muted'
            }`} title="Completado" />
          </div>
        </div>
        {!showTaskForm && (
          <Button
            size="sm"
            onClick={() => setShowTaskForm(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva Tarea
          </Button>
        )}
      </div>

      {/* Task Form */}
      {showTaskForm && (
        <ProductionTaskForm
          itemId={item.id}
          onTaskCreated={handleTaskCreated}
          onCancel={() => setShowTaskForm(false)}
        />
      )}

      {/* Task List */}
      <ProductionTaskList itemId={item.id} />
    </div>
  );
}
