import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductionPhases } from "@/hooks/useProductionPhases";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface ProductionTaskFormProps {
  itemId: string;
  onTaskCreated: () => void;
  onCancel: () => void;
}

export function ProductionTaskForm({
  itemId,
  onTaskCreated,
  onCancel,
}: ProductionTaskFormProps) {
  const { phases, isLoading: phasesLoading } = useProductionPhases();
  const [taskName, setTaskName] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskName.trim() || !selectedPhaseId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await supabase.from("production_tasks").insert({
        sales_order_item_id: itemId,
        phase_id: selectedPhaseId,
        task_name: taskName.trim(),
        operator_id: user.id,
        status: "pending",
      });

      if (error) throw error;

      onTaskCreated();
      setTaskName("");
      setSelectedPhaseId("");
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 border rounded-lg bg-muted/30 ${isMobile ? 'p-4' : 'p-3'}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="taskName" className={isMobile ? "text-sm" : "text-xs"}>Nombre de la tarea</Label>
          <Input
            id="taskName"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Ej: Revisión de archivo"
            className={isMobile ? "h-11 text-base" : "h-8 text-sm"}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phase" className={isMobile ? "text-sm" : "text-xs"}>Fase de producción</Label>
          <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId} required>
            <SelectTrigger id="phase" className={isMobile ? "h-11 text-base" : "h-8 text-sm"}>
              <SelectValue placeholder="Selecciona una fase" />
            </SelectTrigger>
            <SelectContent>
              {phases.map((phase) => (
                <SelectItem key={phase.id} value={phase.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: phase.color }}
                    />
                    {phase.display_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'justify-end'}`}>
        <Button 
          type="button" 
          variant="outline" 
          size={isMobile ? "default" : "sm"} 
          onClick={onCancel}
          className={isMobile ? "h-11" : ""}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size={isMobile ? "default" : "sm"}
          disabled={isSubmitting || phasesLoading || !taskName.trim() || !selectedPhaseId}
          className={isMobile ? "h-11" : ""}
        >
          {isSubmitting ? "Creando..." : "Crear Tarea"}
        </Button>
      </div>
    </form>
  );
}
