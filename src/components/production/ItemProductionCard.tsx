import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProductionTaskForm } from "./ProductionTaskForm";
import { ProductionTaskList } from "./ProductionTaskList";
import { useProductionTasks } from "@/hooks/useProductionTasks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ItemProductionCardProps {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    description?: string | null;
    production_status?: string | null;
  };
  onStatusUpdate?: () => void;
}

export function ItemProductionCard({ item, onStatusUpdate }: ItemProductionCardProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { tasks, refetch } = useProductionTasks(item.id);
  
  const totalTimeSeconds = tasks.reduce((acc, task) => acc + (task.total_time_seconds || 0), 0);
  const totalHours = Math.floor(totalTimeSeconds / 3600);
  const totalMinutes = Math.floor((totalTimeSeconds % 3600) / 60);

  const handleTaskCreated = () => {
    setShowTaskForm(false);
    refetch();
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('sales_order_items')
        .update({ production_status: newStatus })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Estado actualizado correctamente');
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar el estado');
    } finally {
      setIsUpdatingStatus(false);
    }
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
          {/* Tiempo total */}
          <div className="text-right">
            <p className="text-xs font-medium text-muted-foreground">Tiempo total</p>
            <p className="text-sm font-bold text-foreground">{totalHours}h {totalMinutes}m</p>
          </div>
          {/* Estado selector */}
          <Select
            value={item.production_status || 'pending'}
            onValueChange={handleStatusChange}
            disabled={isUpdatingStatus}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En proceso</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
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
