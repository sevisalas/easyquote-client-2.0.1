import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, Sprint, TaskStatus } from "@/hooks/useRoadmap";
import { TaskCard } from "./TaskCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RoadmapKanbanProps {
  tasks: Task[];
  sprints: Sprint[];
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-gray-100 dark:bg-gray-800" },
  { id: "todo", label: "Por hacer", color: "bg-yellow-50 dark:bg-yellow-900/20" },
  { id: "in_progress", label: "En progreso", color: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "testing", label: "Testing", color: "bg-purple-50 dark:bg-purple-900/20" },
  { id: "done", label: "Hecho", color: "bg-green-50 dark:bg-green-900/20" },
];

const SortableTaskCard = ({
  task,
  sprint,
  onEdit,
  onDelete,
}: {
  task: Task;
  sprint?: Sprint | null;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        sprint={sprint}
        onEdit={onEdit}
        onDelete={onDelete}
        isDragging={isDragging}
      />
    </div>
  );
};

export const RoadmapKanban = ({
  tasks,
  sprints,
  onTaskStatusChange,
  onEditTask,
  onDeleteTask,
}: RoadmapKanbanProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getTasksForColumn = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status);

  const findSprint = (sprintId: string | null) =>
    sprintId ? sprints.find((s) => s.id === sprintId) : null;

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const targetColumn = columns.find((col) => col.id === overId);
    if (targetColumn) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== targetColumn.id) {
        onTaskStatusChange(taskId, targetColumn.id);
      }
      return;
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== overTask.status) {
        onTaskStatusChange(taskId, overTask.status);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnTasks = getTasksForColumn(column.id);

          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-72 rounded-lg ${column.color}`}
            >
              <div className="p-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{column.label}</h3>
                  <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-320px)]">
                <SortableContext
                  id={column.id}
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="p-2 space-y-2 min-h-[100px]" data-column={column.id}>
                    {columnTasks.map((task) => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        sprint={findSprint(task.sprint_id)}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                      />
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        Sin tareas
                      </div>
                    )}
                  </div>
                </SortableContext>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard
            task={activeTask}
            sprint={findSprint(activeTask.sprint_id)}
            onEdit={() => {}}
            onDelete={() => {}}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};
