import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Task, Sprint } from "@/hooks/useRoadmap";
import { TaskCategoryBadge, getPriorityColor, getPriorityLabel } from "./TaskCategoryBadge";
import { Clock, Zap, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  task: Task;
  sprint?: Sprint | null;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isDragging?: boolean;
}

export const TaskCard = ({ task, sprint, onEdit, onDelete, isDragging }: TaskCardProps) => {
  return (
    <Card 
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-50 rotate-2 scale-105" : "hover:shadow-md"
      }`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header with category and priority */}
        <div className="flex items-center justify-between gap-2">
          <TaskCategoryBadge category={task.category} />
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
              <Zap className="h-3 w-3" />
              {getPriorityLabel(task.priority)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(task.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title */}
        <h4 className="font-medium text-sm leading-tight">{task.title}</h4>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Footer with sprint and hours */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="truncate max-w-[120px]">
            {sprint ? sprint.name : "Sin sprint"}
          </span>
          {task.estimated_hours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.estimated_hours}h
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
