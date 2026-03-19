import { Sprint, SprintStatus } from "@/hooks/useRoadmap";
import { SprintCard } from "./SprintCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SprintsKanbanProps {
  sprints: Sprint[];
  getSprintStats: (sprintId: string) => { total: number; done: number; progress: number };
  onEdit: (sprint: Sprint) => void;
  onDelete: (sprintId: string) => void;
  onViewObjectives: (sprintId: string) => void;
}

const columns: { id: SprintStatus; label: string; color: string }[] = [
  { id: "planning", label: "Planificación", color: "bg-yellow-50 dark:bg-yellow-900/20" },
  { id: "active", label: "Activos", color: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "completed", label: "Completados", color: "bg-green-50 dark:bg-green-900/20" },
];

export const SprintsKanban = ({
  sprints,
  getSprintStats,
  onEdit,
  onDelete,
  onViewObjectives,
}: SprintsKanbanProps) => {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnSprints = sprints.filter((s) => s.status === column.id);

        return (
          <div
            key={column.id}
            className={`flex-shrink-0 w-80 rounded-lg ${column.color}`}
          >
            <div className="p-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{column.label}</h3>
                <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
                  {columnSprints.length}
                </span>
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="p-2 space-y-2 min-h-[100px]">
                {columnSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    stats={getSprintStats(sprint.id)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewObjectives={onViewObjectives}
                  />
                ))}
                {columnSprints.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Sin sprints
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};
