import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task, Sprint, TaskCategory, TaskPriority, TaskStatus } from "@/hooks/useRoadmap";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  sprints: Sprint[];
  onSave: (task: Partial<Task>) => void;
  isLoading?: boolean;
}

const categories: { value: TaskCategory; label: string }[] = [
  { value: "integration", label: "Integración" },
  { value: "feature", label: "Feature" },
  { value: "improvement", label: "Mejora" },
  { value: "bugfix", label: "Bugfix" },
  { value: "infrastructure", label: "Infraestructura" },
];

const priorities: { value: TaskPriority; label: string }[] = [
  { value: "critical", label: "Crítica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En progreso" },
  { value: "testing", label: "Testing" },
  { value: "done", label: "Hecho" },
];

export const TaskDialog = ({
  open,
  onOpenChange,
  task,
  sprints,
  onSave,
  isLoading,
}: TaskDialogProps) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "feature" as TaskCategory,
    priority: "medium" as TaskPriority,
    status: "backlog" as TaskStatus,
    sprint_id: null as string | null,
    estimated_hours: null as number | null,
    notes: "",
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        category: task.category,
        priority: task.priority,
        status: task.status,
        sprint_id: task.sprint_id,
        estimated_hours: task.estimated_hours,
        notes: task.notes || "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        category: "feature",
        priority: "medium",
        status: "backlog",
        sprint_id: null,
        estimated_hours: null,
        notes: "",
      });
    }
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: task?.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarea" : "Nueva Tarea"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Nombre de la tarea"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción detallada"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value: TaskCategory) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: TaskPriority) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value: TaskStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sprint</Label>
              <Select
                value={formData.sprint_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, sprint_id: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin sprint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sprint</SelectItem>
                  {sprints.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimated_hours">Horas estimadas</Label>
            <Input
              id="estimated_hours"
              type="number"
              min={0}
              value={formData.estimated_hours || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estimated_hours: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales, enlaces, etc."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.title.trim()}>
              {isLoading ? "Guardando..." : task ? "Guardar cambios" : "Crear tarea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
