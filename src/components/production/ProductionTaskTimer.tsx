import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Play, Pause, Square, Timer, Circle, CheckCircle2, Loader2 } from "lucide-react";
import { ProductionTask } from "@/hooks/useProductionTasks";

interface ProductionTaskTimerProps {
  task: ProductionTask;
  onUpdate: (taskId: string, updates: any) => Promise<void>;
}

export function ProductionTaskTimer({ task, onUpdate }: ProductionTaskTimerProps) {
  const [elapsedTime, setElapsedTime] = useState(task.total_time_seconds);
  const [comments, setComments] = useState(task.comments || "");
  const [showTimer, setShowTimer] = useState(task.total_time_seconds > 0);
  const [isRunning, setIsRunning] = useState(
    task.status === "in_progress" && task.total_time_seconds > 0
  );

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

  // Cambios de estado manuales (sin cronómetro)
  const setStatus = async (status: "pending" | "in_progress" | "completed") => {
    setIsRunning(false);
    const updates: any = { status };
    if (status === "pending") {
      updates.started_at = null;
      updates.paused_at = null;
      updates.completed_at = null;
    }
    if (status === "in_progress") {
      updates.started_at = task.started_at || new Date().toISOString();
      updates.paused_at = null;
      updates.completed_at = null;
    }
    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
    }
    await onUpdate(task.id, updates);
  };

  const handleCommentChange = async (value: string) => {
    setComments(value);
    await onUpdate(task.id, {
      comments: value,
    });
  };

  const isCompleted = task.status === "completed";

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      {/* Gestión de estado manual (siempre visible) */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setStatus("pending")}
          size="sm"
          variant={task.status === "pending" ? "default" : "outline"}
        >
          <Circle className="h-4 w-4 mr-1" />
          Pendiente
        </Button>
        <Button
          onClick={() => setStatus("in_progress")}
          size="sm"
          variant={task.status === "in_progress" ? "default" : "outline"}
        >
          <Loader2 className="h-4 w-4 mr-1" />
          En curso
        </Button>
        <Button
          onClick={() => setStatus("completed")}
          size="sm"
          variant={isCompleted ? "default" : "outline"}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Terminada
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {(showTimer || elapsedTime > 0) && (
            <span className="text-sm font-mono font-semibold tabular-nums">
              {formatTime(elapsedTime)}
            </span>
          )}
          <Button
            onClick={() => setShowTimer((v) => !v)}
            size="sm"
            variant="ghost"
            title="Cronómetro opcional"
          >
            <Timer className="h-4 w-4 mr-1" />
            {showTimer ? "Ocultar tiempo" : "Usar cronómetro"}
          </Button>
        </div>
      </div>

      {/* Cronómetro opcional */}
      {showTimer && (
        <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
          <div className="text-2xl font-mono font-bold tabular-nums">
            {formatTime(elapsedTime)}
          </div>
          <div className="flex gap-2">
            {!isRunning && !isCompleted && (
              <Button onClick={handleStart} size="sm" variant="default">
                <Play className="h-4 w-4 mr-1" />
                {task.status === "paused" ? "Reanudar" : "Iniciar"}
              </Button>
            )}
            {isRunning && (
              <Button onClick={handlePause} size="sm" variant="secondary">
                <Pause className="h-4 w-4 mr-1" />
                Pausar
              </Button>
            )}
            {!isCompleted && (isRunning || task.status === "paused") && (
              <Button onClick={handleFinish} size="sm" variant="destructive">
                <Square className="h-4 w-4 mr-1" />
                Finalizar
              </Button>
            )}
          </div>
        </div>
      )}

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
