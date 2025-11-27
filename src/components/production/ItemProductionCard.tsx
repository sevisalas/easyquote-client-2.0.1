import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import { ProductionTaskForm } from "./ProductionTaskForm";
import { ProductionTaskList } from "./ProductionTaskList";
import { useProductionTasks } from "@/hooks/useProductionTasks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImpositionData } from "@/utils/impositionCalculator";
import { ImpositionScheme } from "./ImpositionScheme";
import { ImpositionModal } from "./ImpositionModal";

interface ItemProductionCardProps {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    description?: string | null;
    production_status?: string | null;
    imposition_data?: any;
  };
  onStatusUpdate?: () => void;
}

export function ItemProductionCard({ item, onStatusUpdate }: ItemProductionCardProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showImpositionModal, setShowImpositionModal] = useState(false);
  const isMobile = useIsMobile();
  const { tasks, refetch } = useProductionTasks(item.id);
  
  const totalTimeSeconds = tasks.reduce((acc, task) => acc + (task.total_time_seconds || 0), 0);
  const totalHours = Math.floor(totalTimeSeconds / 3600);
  const totalMinutes = Math.floor((totalTimeSeconds % 3600) / 60);

  // Datos por defecto para imposición
  const defaultImpositionData: ImpositionData = {
    productWidth: 210,
    productHeight: 297,
    bleed: 3,
    sheetWidth: 700,
    sheetHeight: 1000,
    validWidth: 680,
    validHeight: 980,
    gutterH: 5,
    gutterV: 5,
  };

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

  const handleSaveImposition = async (data: ImpositionData) => {
    try {
      const { error } = await supabase
        .from('sales_order_items')
        .update({ imposition_data: data as any })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Imposición guardada correctamente');
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Error saving imposition:', error);
      toast.error('Error al guardar la imposición');
    }
  };

  return (
    <div className="space-y-3">
      {/* Compact Product Info */}
      <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3`}>
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-1 items-center'} gap-3`}>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground">Producto</p>
            <p className="text-sm font-semibold">{item.product_name}</p>
          </div>
          {/* Tiempo total */}
          <div className={isMobile ? '' : 'text-right'}>
            <p className="text-xs font-medium text-muted-foreground">Tiempo total</p>
            <p className="text-sm font-bold text-foreground">{totalHours}h {totalMinutes}m</p>
          </div>
          {/* Estado selector */}
          <Select
            value={item.production_status || 'pending'}
            onValueChange={handleStatusChange}
            disabled={isUpdatingStatus}
          >
            <SelectTrigger className={isMobile ? "w-full h-11" : "w-[140px] h-8"}>
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
            size={isMobile ? "default" : "sm"}
            variant="secondary"
            onClick={() => setShowTaskForm(true)}
            className={isMobile ? "w-full h-11" : ""}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva Tarea
          </Button>
        )}
      </div>

      {/* Imposition Section */}
      {item.imposition_data ? (
        <div className="flex gap-3 items-center p-3 bg-muted/30 rounded-md">
          <div className="flex-shrink-0">
            <ImpositionScheme data={item.imposition_data} compact={true} />
          </div>
          
          <div className="flex-1 flex items-center gap-4">
            <p className="text-sm font-medium text-muted-foreground">
              {item.imposition_data.repetitionsH}×{item.imposition_data.repetitionsV} = {item.imposition_data.totalRepetitions} por pliego
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              Aprovechamiento: {item.imposition_data.utilization?.toFixed(1)}%
            </p>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowImpositionModal(true)}
            className="h-8 flex-shrink-0"
          >
            <Settings className="h-3 w-3 mr-1" />
            Editar
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowImpositionModal(true)}
          className="w-fit"
        >
          <Settings className="h-3 w-3 mr-1" />
          Activar imposición
        </Button>
      )}

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

      {/* Imposition Modal */}
      <ImpositionModal
        open={showImpositionModal}
        onOpenChange={setShowImpositionModal}
        initialData={item.imposition_data || defaultImpositionData}
        onSave={handleSaveImposition}
      />
    </div>
  );
}
