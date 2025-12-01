import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useProductionVariables } from "@/hooks/useProductionVariables";
import type { ProductionVariable } from "@/hooks/useProductionVariables";

export default function ProductionVariables() {
  const { variables, isLoading, createVariable, updateVariable, deleteVariable } =
    useProductionVariables();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<ProductionVariable | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    has_implicit_task: false,
    task_name: "",
  });

  const handleCreate = () => {
    createVariable(formData);
    setIsCreateDialogOpen(false);
    setFormData({ name: "", description: "", has_implicit_task: false, task_name: "" });
  };

  const handleEdit = () => {
    if (!selectedVariable) return;
    updateVariable({
      id: selectedVariable.id,
      updates: formData,
    });
    setIsEditDialogOpen(false);
    setSelectedVariable(null);
    setFormData({ name: "", description: "", has_implicit_task: false, task_name: "" });
  };

  const handleDelete = () => {
    if (!selectedVariable) return;
    deleteVariable(selectedVariable.id);
    setIsDeleteDialogOpen(false);
    setSelectedVariable(null);
  };

  const openEditDialog = (variable: ProductionVariable) => {
    setSelectedVariable(variable);
    setFormData({
      name: variable.name,
      description: variable.description || "",
      has_implicit_task: variable.has_implicit_task || false,
      task_name: variable.task_name || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (variable: ProductionVariable) => {
    setSelectedVariable(variable);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Cargando variables de producción...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Variables de producción</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona las variables que se utilizarán para agrupar, calcular y organizar los trabajos de producción
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva variable
        </Button>
      </div>

      {variables.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No hay variables de producción configuradas
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear primera variable
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tarea implícita</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variables.map((variable) => (
              <TableRow key={variable.id}>
                <TableCell className="font-medium">{variable.name}</TableCell>
                <TableCell>{variable.description || "—"}</TableCell>
                <TableCell className="capitalize">{variable.variable_type}</TableCell>
                <TableCell>
                  {variable.has_implicit_task ? (
                    <span className="text-sm">{variable.task_name || "Sí"}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(variable)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(variable)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva variable de producción</DialogTitle>
            <DialogDescription>
              Crea una nueva variable que podrás mapear a prompts y outputs de productos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej: Papel, Acabado, Tamaño"
              />
            </div>
            <div>
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripción de la variable"
              />
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox
                id="has-implicit-task"
                checked={formData.has_implicit_task}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, has_implicit_task: checked === true })
                }
              />
              <div className="grid gap-1.5 leading-none flex-1">
                <Label htmlFor="has-implicit-task" className="cursor-pointer">
                  Crear tarea automáticamente
                </Label>
                <p className="text-sm text-muted-foreground">
                  Cuando un pedido incluya esta variable, se creará una tarea pendiente
                </p>
              </div>
            </div>
            {formData.has_implicit_task && (
              <div>
                <Label htmlFor="task-name">Nombre de la tarea</Label>
                <Input
                  id="task-name"
                  value={formData.task_name}
                  onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                  placeholder="Nombre de la tarea a crear"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar variable de producción</DialogTitle>
            <DialogDescription>
              Modifica los datos de la variable
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Descripción (opcional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox
                id="edit-has-implicit-task"
                checked={formData.has_implicit_task}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, has_implicit_task: checked === true })
                }
              />
              <div className="grid gap-1.5 leading-none flex-1">
                <Label htmlFor="edit-has-implicit-task" className="cursor-pointer">
                  Crear tarea automáticamente
                </Label>
                <p className="text-sm text-muted-foreground">
                  Cuando un pedido incluya esta variable, se creará una tarea pendiente
                </p>
              </div>
            </div>
            {formData.has_implicit_task && (
              <div>
                <Label htmlFor="edit-task-name">Nombre de la tarea</Label>
                <Input
                  id="edit-task-name"
                  value={formData.task_name}
                  onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                  placeholder="Nombre de la tarea a crear"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar variable?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también todos los mapeos asociados a esta variable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
