import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Cog, Hand } from "lucide-react";
import {
  useProductionResources,
  type ProductionResource,
  type ProductionResourceType,
} from "@/hooks/useProductionResources";
import { useProductionPhases } from "@/hooks/useProductionPhases";

const TYPE_LABEL: Record<ProductionResourceType, string> = {
  machine: "Máquina",
  manual: "Proceso manual",
};

export function ProductionResourcesPanel() {
  const { resources, isLoading, createResource, updateResource, deleteResource } =
    useProductionResources();
  const { phases } = useProductionPhases();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ProductionResource | null>(null);
  const [form, setForm] = useState<{
    name: string;
    resource_type: ProductionResourceType;
    phase_id: string | null;
  }>({
    name: "",
    resource_type: "machine",
    phase_id: null,
  });

  const resetForm = () => setForm({ name: "", resource_type: "machine", phase_id: null });

  const onCreate = () => {
    if (!form.name.trim()) return;
    createResource({
      name: form.name.trim(),
      resource_type: form.resource_type,
      phase_id: form.phase_id,
    });
    setCreateOpen(false);
    resetForm();
  };

  const onEdit = () => {
    if (!selected || !form.name.trim()) return;
    updateResource({
      id: selected.id,
      name: form.name.trim(),
      resource_type: form.resource_type,
      phase_id: form.phase_id,
    });
    setEditOpen(false);
    setSelected(null);
    resetForm();
  };

  const openEdit = (r: ProductionResource) => {
    setSelected(r);
    setForm({ name: r.name, resource_type: r.resource_type, phase_id: r.phase_id });
    setEditOpen(true);
  };

  const openDelete = (r: ProductionResource) => {
    setSelected(r);
    setDeleteOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recursos de producción</CardTitle>
            <CardDescription>
              Máquinas y procesos manuales disponibles en el taller
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo recurso
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : resources.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No hay recursos configurados</p>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer recurso
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 px-3 py-2 border rounded-md"
              >
                {r.resource_type === "machine" ? (
                  <Cog className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Hand className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm font-medium truncate flex-1 min-w-0">{r.name}</span>
                {r.phase_id && (() => {
                  const phase = phases.find((p) => p.id === r.phase_id);
                  if (!phase) return null;
                  return (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[110px]">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: phase.color }}
                      />
                      <span className="truncate">{phase.display_name}</span>
                    </span>
                  );
                })()}
                <Badge variant="secondary" className="text-xs">
                  {TYPE_LABEL[r.resource_type]}
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDelete(r)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Crear */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo recurso de producción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="res-name">Nombre</Label>
              <Input
                id="res-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Heidelberg SM 52, Plegadora, Manipulado..."
                className="mt-2"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.resource_type}
                onValueChange={(v) => setForm({ ...form, resource_type: v as ProductionResourceType })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="machine">Máquina</SelectItem>
                  <SelectItem value="manual">Proceso manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={onCreate} disabled={!form.name.trim()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar recurso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="res-name-edit">Nombre</Label>
              <Input
                id="res-name-edit"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.resource_type}
                onValueChange={(v) => setForm({ ...form, resource_type: v as ProductionResourceType })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="machine">Máquina</SelectItem>
                  <SelectItem value="manual">Proceso manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={onEdit} disabled={!form.name.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar recurso</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar "{selected?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selected) deleteResource(selected.id);
                setDeleteOpen(false);
                setSelected(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}