import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sprint } from "@/hooks/useRoadmap";
import { Calendar, Pencil, Trash2, Play, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SprintCardProps {
  sprint: Sprint;
  stats: { total: number; done: number; progress: number };
  onEdit: (sprint: Sprint) => void;
  onDelete: (sprintId: string) => void;
  onViewTasks: (sprintId: string) => void;
}

const statusConfig = {
  planning: {
    label: "Planificación",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    Icon: Clock,
  },
  active: {
    label: "Activo",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    Icon: Play,
  },
  completed: {
    label: "Completado",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Icon: CheckCircle,
  },
};

export const SprintCard = ({ sprint, stats, onEdit, onDelete, onViewTasks }: SprintCardProps) => {
  const config = statusConfig[sprint.status];
  const { Icon } = config;

  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{sprint.name}</CardTitle>
            <Badge variant="outline" className={`${config.className} border-none gap-1`}>
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(sprint)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(sprint.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sprint.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {sprint.description}
          </p>
        )}

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progreso</span>
            <span className="font-medium">{stats.progress}% ({stats.done}/{stats.total})</span>
          </div>
          <Progress value={stats.progress} className="h-2" />
        </div>

        {/* Dates */}
        {(sprint.start_date || sprint.end_date) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {sprint.start_date && format(new Date(sprint.start_date), "dd MMM", { locale: es })}
            {sprint.start_date && sprint.end_date && " - "}
            {sprint.end_date && format(new Date(sprint.end_date), "dd MMM yyyy", { locale: es })}
          </div>
        )}

        <Button 
          variant="outline" 
          className="w-full" 
          size="sm"
          onClick={() => onViewTasks(sprint.id)}
        >
          Ver tareas
        </Button>
      </CardContent>
    </Card>
  );
};
