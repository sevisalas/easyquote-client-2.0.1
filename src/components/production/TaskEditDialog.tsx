import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProductionResources } from "@/hooks/useProductionResources";
import { useProductionPhases } from "@/hooks/useProductionPhases";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export type EditableTask = {
  id: string;
  taskName: string;
  status: "pending" | "in_progress" | "paused" | "completed";
  phaseId: string;
  resourceId: string | null;
};

interface Props {
  task: EditableTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const STATUS_OPTIONS: Array<{ value: EditableTask["status"]; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En curso" },
  { value: "paused", label: "Pausada" },
  { value: "completed", label: "Hecha" },
];

export function TaskEditDialog({ task, open, onOpenChange, onSaved }: Props) {
  const { resources } = useProductionResources();
  const { phases } = useProductionPhases();
  const { toast } = useToast();
  const [taskName, setTaskName] = useState("");
  const [status, setStatus] = useState<EditableTask["status"]>("pending");
  const [phaseId, setPhaseId] = useState<string>("");
  const [resourceId, setResourceId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (task) {
      setTaskName(task.taskName);
      setStatus(task.status);
      setPhaseId(task.phaseId);
      setResourceId(task.resourceId || "");
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("production_tasks")
        .update({
          task_name: taskName.trim() || task.taskName,
          status,
          phase_id: phaseId,
          resource_id: resourceId || null,
        })
        .eq("id", task.id);
      if (error) throw error;
      toast({ title: "Tarea actualizada" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("production_tasks").delete().eq("id", task.id);
      if (error) throw error;
      toast({ title: "Tarea eliminada" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const phaseResources = resources.filter((r) => r.phase_id === phaseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fase</Label>
            <Select value={phaseId} onValueChange={(v) => { setPhaseId(v); setResourceId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {phases.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.display_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recurso</Label>
            <Select value={resourceId || "__none__"} onValueChange={(v) => setResourceId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin recurso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin recurso</SelectItem>
                {phaseResources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
                {phaseResources.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No hay recursos para esta fase</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as EditableTask["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting || saving}>
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !phaseId}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}