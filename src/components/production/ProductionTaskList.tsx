import { Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductionTask, useProductionTasks } from "@/hooks/useProductionTasks";
import { useProductionPhases } from "@/hooks/useProductionPhases";
import { ProductionTaskTimer } from "./ProductionTaskTimer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect, useMemo } from "react";

interface ProductionTaskListProps {
  itemId: string;
}

export function ProductionTaskList({ itemId }: ProductionTaskListProps) {
  const { tasks, updateTask, deleteTask } = useProductionTasks(itemId);
  const { phases } = useProductionPhases();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Memorizar el string de IDs activos para evitar bucles infinitos
  const activeTasksKey = useMemo(
    () => tasks
      .filter(t => t.status === 'in_progress' || t.status === 'paused')
      .map(t => t.id)
      .sort()
      .join(','),
    [tasks]
  );

  // Auto-expandir tareas en progreso o pausadas solo cuando cambia activeTasksKey
  useEffect(() => {
    if (!activeTasksKey) {
      setExpandedTasks(new Set());
      return;
    }
    
    const activeTaskIds = activeTasksKey.split(',').filter(id => id);
    setExpandedTasks(new Set(activeTaskIds));
  }, [activeTasksKey]);

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
      <div className="text-center py-4 text-xs text-muted-foreground">
        No hay tareas de producción para este artículo
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const phaseDisplay = getPhaseDisplay(task.phase_id);
        const isExpanded = expandedTasks.has(task.id);

        return (
          <Collapsible
            key={task.id}
            open={isExpanded}
            onOpenChange={(open) => {
              const newExpanded = new Set(expandedTasks);
              if (open) {
                newExpanded.add(task.id);
              } else {
                newExpanded.delete(task.id);
              }
              setExpandedTasks(newExpanded);
            }}
          >
            <div className="border rounded-lg bg-card">
              <CollapsibleTrigger className="w-full p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform shrink-0 ${
                        isExpanded ? "transform rotate-180" : ""
                      }`}
                    />
                    <h4 className="font-medium text-sm truncate">{task.task_name}</h4>
                    {phaseDisplay && (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0"
                        style={{
                          borderColor: phaseDisplay.color,
                          color: phaseDisplay.color,
                        }}
                      >
                        {phaseDisplay.name}
                      </Badge>
                    )}
                    {getStatusBadge(task.status)}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {task.operator_name || 'Usuario'}
                    </span>
                    <span className="text-xs font-medium text-foreground shrink-0">
                      {Math.floor(task.total_time_seconds / 3600)}h {Math.floor((task.total_time_seconds % 3600) / 60)}m
                    </span>
                  </div>
                  {task.status !== "completed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-3 pb-3 pt-2">
                  <ProductionTaskTimer task={task} onUpdate={updateTask} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
