import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { useProductionPhases, type ProductionPhase } from "@/hooks/useProductionPhases";

const PRESET_COLORS = ["#3B82F6", "#E91E8C", "#00D4FF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6B7280"];

export function ProductionPhasesPanel() {
  const { phases, organizationId, createPhase, updatePhase, deletePhase } = useProductionPhases();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ProductionPhase | null>(null);
  const [form, setForm] = useState({ display_name: "", color: PRESET_COLORS[0] });

  const reset = () => setForm({ display_name: "", color: PRESET_COLORS[0] });

  const openEdit = (p: ProductionPhase) => {
    setSelected(p);
    setForm({ display_name: p.display_name, color: p.color });
    setIsEditOpen(true);
  };

  const openDelete = (p: ProductionPhase) => {
    setSelected(p);
    setIsDeleteOpen(true);
  };

  const handleCreate = () => {
    if (!form.display_name.trim()) return;
    createPhase(form);
    setIsCreateOpen(false);
    reset();
  };

  const handleEdit = () => {
    if (!selected || !form.display_name.trim()) return;
    updatePhase({ id: selected.id, display_name: form.display_name, color: form.color });
    setIsEditOpen(false);
    setSelected(null);
    reset();
  };

  const handleDelete = () => {
    if (!selected) return;
    deletePhase(selected.id);
    setIsDeleteOpen(false);
    setSelected(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fases de producción</CardTitle>
            <CardDescription>Crea, edita o elimina fases personalizadas</CardDescription>
          </div>
          <Button onClick={() => { reset(); setIsCreateOpen(true); }} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva fase
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {phases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin fases</p>
        ) : (
          <div className="space-y-1">
            {phases.map((phase) => {
              const isGlobal = phase.organization_id === null;
              const canEdit = !isGlobal && phase.organization_id === organizationId;
              return (
                <div key={phase.id} className="flex items-center gap-2 px-2 py-1 border rounded-md">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                  <span className="text-sm font-medium truncate flex-1 min-w-0">{phase.display_name}</span>
                  {isGlobal && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canEdit} onClick={() => openEdit(phase)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canEdit} onClick={() => openDelete(phase)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva fase</DialogTitle>
            <DialogDescription>Esta fase solo será visible en tu organización.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-phase-name">Nombre</Label>
              <Input id="new-phase-name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="ej: Acabados especiales" />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.display_name.trim()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar fase</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-phase-name">Nombre</Label>
              <Input id="edit-phase-name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={!form.display_name.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar fase?</AlertDialogTitle>
            <AlertDialogDescription>
              La fase "{selected?.display_name}" se eliminará. Las tareas existentes que la usen seguirán referenciándola.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
