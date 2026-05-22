import { useState, useMemo } from "react";
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
import { useDefaultProductionTasks } from "@/hooks/useDefaultProductionTasks";
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
  const { tasks: defaultTasks, isLoading: defaultsLoading } = useDefaultProductionTasks();
  const [taskName, setTaskName] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [selectedDefaultId, setSelectedDefaultId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();

  const handlePickDefault = (id: string) => {
    setSelectedDefaultId(id);
    if (id === "__custom__") {
      setTaskName("");
      setSelectedPhaseId("");
      return;
    }
    const t = defaultTasks.find((x) => x.id === id);
    if (t) {
      setTaskName(t.task_name);
      setSelectedPhaseId(t.phase_id);
    }
  };

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
      {defaultTasks.length > 0 && (
        <div className="space-y-1.5">
          <Label className={isMobile ? "text-sm" : "text-xs"}>Tarea predefinida</Label>
          <Select value={selectedDefaultId} onValueChange={handlePickDefault}>
            <SelectTrigger className={isMobile ? "h-11 text-base" : "h-8 text-sm"}>
              <SelectValue placeholder={defaultsLoading ? "Cargando..." : "Elige una tarea predefinida o personaliza"} />
            </SelectTrigger>
            <SelectContent>
              {defaultTasks.map((t) => {
                const phase = phases.find((p) => p.id === t.phase_id);
                return (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      {phase && (
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: phase.color }}
                        />
                      )}
                      {t.task_name}
                      {phase && <span className="text-muted-foreground text-xs">· {phase.display_name}</span>}
                    </span>
                  </SelectItem>
                );
              })}
              <SelectItem value="__custom__">Personalizada…</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
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
