import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProductionTaskForm } from "./ProductionTaskForm";
import { ProductionTaskList } from "./ProductionTaskList";
import { useProductionTasks } from "@/hooks/useProductionTasks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImpositionSection } from "./ImpositionSection";

interface ItemProductionCardProps {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    description?: string | null;
    production_status?: string | null;
    imposition_data?: any;
    composite_data?: any;
    observations?: any[];
    product_id?: string;
    prompts?: any;
    outputs?: any;
    organization_id?: string;
  };
  onStatusUpdate?: (itemId: string, newStatus: string) => void;
  onTaskCreated?: () => void;
}

export function ItemProductionCard({ item, onStatusUpdate, onTaskCreated }: ItemProductionCardProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const isMobile = useIsMobile();
  const { tasks, refetch } = useProductionTasks(item.id);
  
  const totalTimeSeconds = tasks.reduce((acc, task) => acc + (task.total_time_seconds || 0), 0);
  const totalHours = Math.floor(totalTimeSeconds / 3600);
  const totalMinutes = Math.floor((totalTimeSeconds % 3600) / 60);


  const handleTaskCreated = () => {
    setShowTaskForm(false);
    refetch();
    onTaskCreated?.();
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
        onStatusUpdate(item.id, newStatus);
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tareas</p>
      
      {/* Time + new task row */}
      <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Tiempo total</p>
          <p className="text-sm font-bold text-foreground">{totalHours}h {totalMinutes}m</p>
        </div>
        {!showTaskForm && (
          <Button
            size={isMobile ? "default" : "sm"}
            variant="secondary"
            onClick={() => setShowTaskForm(true)}
            className={isMobile ? "w-full h-11" : ""}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva tarea
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
