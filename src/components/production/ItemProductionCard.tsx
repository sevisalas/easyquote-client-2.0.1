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
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">Producto</p>
          <p className="text-sm font-semibold">{item.product_name}</p>
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
