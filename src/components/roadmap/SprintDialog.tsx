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
import { Sprint, SprintStatus } from "@/hooks/useRoadmap";

interface SprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint?: Sprint | null;
  onSave: (sprint: Partial<Sprint>) => void;
  isLoading?: boolean;
}

const statuses: { value: SprintStatus; label: string }[] = [
  { value: "planning", label: "Planificación" },
  { value: "active", label: "Activo" },
  { value: "completed", label: "Completado" },
];

export const SprintDialog = ({
  open,
  onOpenChange,
  sprint,
  onSave,
  isLoading,
}: SprintDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "planning" as SprintStatus,
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (sprint) {
      setFormData({
        name: sprint.name,
        description: sprint.description || "",
        status: sprint.status,
        start_date: sprint.start_date || "",
        end_date: sprint.end_date || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        status: "planning",
        start_date: "",
        end_date: "",
      });
    }
  }, [sprint, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: sprint?.id,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{sprint ? "Editar Sprint" : "Nuevo Sprint"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Sprint Q1 2026, Enero 2026..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Objetivos del sprint"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value: SprintStatus) =>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Fecha inicio</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Fecha fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading ? "Guardando..." : sprint ? "Guardar cambios" : "Crear sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
