import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Play, Pause, Square } from "lucide-react";
import { ProductionTask } from "@/hooks/useProductionTasks";

interface ProductionTaskTimerProps {
  task: ProductionTask;
  onUpdate: (taskId: string, updates: any) => Promise<void>;
}

export function ProductionTaskTimer({ task, onUpdate }: ProductionTaskTimerProps) {
  const [elapsedTime, setElapsedTime] = useState(task.total_time_seconds);
  const [comments, setComments] = useState(task.comments || "");
  const [isRunning, setIsRunning] = useState(task.status === "in_progress");

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = async () => {
    setIsRunning(true);
    await onUpdate(task.id, {
      status: "in_progress",
      started_at: task.started_at || new Date().toISOString(),
      paused_at: null,
    });
  };

  const handlePause = async () => {
    setIsRunning(false);
    await onUpdate(task.id, {
      status: "paused",
      paused_at: new Date().toISOString(),
      total_time_seconds: elapsedTime,
    });
  };

  const handleFinish = async () => {
    setIsRunning(false);
    await onUpdate(task.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      total_time_seconds: elapsedTime,
      comments: comments,
    });
  };

  const handleCommentChange = async (value: string) => {
    setComments(value);
    await onUpdate(task.id, {
      comments: value,
    });
  };

  const canStart = task.status === "pending" || task.status === "paused";
  const canPause = task.status === "in_progress";
  const canFinish = task.status === "in_progress" || task.status === "paused";
  const isCompleted = task.status === "completed";

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-mono font-bold">{formatTime(elapsedTime)}</div>
        <div className="flex gap-2">
          {canStart && (
            <Button onClick={handleStart} size="sm" variant="default">
              <Play className="h-4 w-4 mr-1" />
              {task.status === "paused" ? "Reanudar" : "Iniciar"}
            </Button>
          )}
          {canPause && (
            <Button onClick={handlePause} size="sm" variant="secondary">
              <Pause className="h-4 w-4 mr-1" />
              Pausar
            </Button>
          )}
          {canFinish && !isCompleted && (
            <Button onClick={handleFinish} size="sm" variant="destructive">
              <Square className="h-4 w-4 mr-1" />
              Finalizar
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Comentarios</label>
        <Textarea
          value={comments}
          onChange={(e) => handleCommentChange(e.target.value)}
          placeholder="Añade comentarios sobre esta tarea..."
          disabled={isCompleted}
          rows={3}
        />
      </div>

      {isCompleted && (
        <div className="text-sm text-muted-foreground">
          ✓ Tarea completada
        </div>
      )}
    </div>
  );
}
