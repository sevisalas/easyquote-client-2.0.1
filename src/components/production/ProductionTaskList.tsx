import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductionTask, useProductionTasks } from "@/hooks/useProductionTasks";
import { useProductionPhases } from "@/hooks/useProductionPhases";
import { ProductionTaskTimer } from "./ProductionTaskTimer";

interface ProductionTaskListProps {
  itemId: string;
}

export function ProductionTaskList({ itemId }: ProductionTaskListProps) {
  const { tasks, updateTask, deleteTask } = useProductionTasks(itemId);
  const { phases } = useProductionPhases();

  const getPhaseDisplay = (phaseId: string) => {
    const phase = phases.find((p) => p.id === phaseId);
    return phase ? { name: phase.display_name, color: phase.color } : null;
  };

  const getStatusBadge = (status: ProductionTask["status"]) => {
    const statusConfig = {
      pending: { label: "Pendiente", variant: "secondary" as const },
      in_progress: { label: "En progreso", variant: "default" as const },
      paused: { label: "Pausada", variant: "outline" as const },
      completed: { label: "Completada", variant: "success" as const },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay tareas de producción para este artículo
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const phaseDisplay = getPhaseDisplay(task.phase_id);

        return (
          <div key={task.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold">{task.task_name}</h4>
                {phaseDisplay && (
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: phaseDisplay.color,
                      color: phaseDisplay.color,
                    }}
                  >
                    {phaseDisplay.name}
                  </Badge>
                )}
                {getStatusBadge(task.status)}
              </div>
              {task.status !== "completed" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteTask(task.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <ProductionTaskTimer task={task} onUpdate={updateTask} />
          </div>
        );
      })}
    </div>
  );
}
