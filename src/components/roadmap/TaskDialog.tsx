import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Task, Sprint, TaskCategory, TaskPriority, TaskStatus } from "@/hooks/useRoadmap";
import { Search, X, Plus } from "lucide-react";

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
    sprint_ids: [] as string[],
    estimated_hours: null as number | null,
    notes: "",
  });

  const [sprintSearch, setSprintSearch] = useState("");
  const [sprintPopoverOpen, setSprintPopoverOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        category: task.category,
        priority: task.priority,
        status: task.status,
        sprint_ids: task.sprint_ids || [],
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
        sprint_ids: [],
        estimated_hours: null,
        notes: "",
      });
    }
    setSprintSearch("");
  }, [task, open]);

  const availableSprints = useMemo(() => {
    const notStarted = ["backlog", "todo"].includes(formData.status);
    return sprints.filter((s) => {
      if (formData.sprint_ids.includes(s.id)) return false;
      if (notStarted && s.status === "completed") return false;
      if (sprintSearch && !s.name.toLowerCase().includes(sprintSearch.toLowerCase())) return false;
      return true;
    });
  }, [sprints, formData.sprint_ids, formData.status, sprintSearch]);

  const selectedSprints = sprints.filter((s) => formData.sprint_ids.includes(s.id));

  const addSprint = (sprintId: string) => {
    setFormData({ ...formData, sprint_ids: [...formData.sprint_ids, sprintId] });
    setSprintSearch("");
    setSprintPopoverOpen(false);
  };

  const removeSprint = (sprintId: string) => {
    setFormData({ ...formData, sprint_ids: formData.sprint_ids.filter((id) => id !== sprintId) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: task?.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Editar objetivo" : "Nuevo objetivo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Nombre del objetivo"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción detallada"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
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
          </div>

          <div className="space-y-1.5">
            <Label>Sprints</Label>
            {selectedSprints.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {selectedSprints.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
                    {s.name}
                    <button
                      type="button"
                      onClick={() => removeSprint(s.id)}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Popover open={sprintPopoverOpen} onOpenChange={setSprintPopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start text-muted-foreground">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Añadir sprint…
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="flex items-center gap-2 border-b pb-2 mb-1">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input
                    value={sprintSearch}
                    onChange={(e) => setSprintSearch(e.target.value)}
                    placeholder="Buscar sprint…"
                    className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {availableSprints.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      {sprintSearch ? "Sin resultados" : "No hay sprints disponibles"}
                    </p>
                  ) : (
                    availableSprints.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addSprint(s.id)}
                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                      >
                        {s.name}
                        {s.status === "completed" && (
                          <span className="text-xs text-muted-foreground ml-1">(completado)</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
          </div>

          <div className="space-y-1.5">
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
              {isLoading ? "Guardando..." : task ? "Guardar cambios" : "Crear objetivo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
