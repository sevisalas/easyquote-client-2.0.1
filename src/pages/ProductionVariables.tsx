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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductionVariables } from "@/hooks/useProductionVariables";
import type { ProductionVariable } from "@/hooks/useProductionVariables";
import { useProductionPhases } from "@/hooks/useProductionPhases";

export default function ProductionVariables() {
  const { variables, isLoading, createVariable, updateVariable, deleteVariable } =
    useProductionVariables();
  const { phases, isLoading: phasesLoading } = useProductionPhases();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<ProductionVariable | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    has_implicit_task: false,
    task_name: "",
    task_phase_id: "",
    task_exclude_values: "",
  });
  // Removed workload capacity state and handlers - now in WorkloadConfiguration page

  const handleCreate = () => {
    createVariable({
      name: formData.name,
      description: formData.description,
      has_implicit_task: formData.has_implicit_task,
      task_name: formData.task_name,
      task_phase_id: formData.task_phase_id || undefined,
      task_exclude_values: formData.task_exclude_values
        ? formData.task_exclude_values.split(",").map(v => v.trim()).filter(Boolean)
        : [],
    });
    setIsCreateDialogOpen(false);
    setFormData({ 
      name: "", 
      description: "", 
      has_implicit_task: false, 
      task_name: "",
      task_phase_id: "",
      task_exclude_values: "",
    });
  };

  const handleEdit = () => {
    if (!selectedVariable) return;
    updateVariable({
      id: selectedVariable.id,
      updates: {
        name: formData.name,
        description: formData.description,
        has_implicit_task: formData.has_implicit_task,
        task_name: formData.task_name,
        task_phase_id: formData.task_phase_id || undefined,
        task_exclude_values: formData.task_exclude_values
          ? formData.task_exclude_values.split(",").map(v => v.trim()).filter(Boolean)
          : [],
      },
    });
    setIsEditDialogOpen(false);
    setSelectedVariable(null);
    setFormData({ 
      name: "", 
      description: "", 
      has_implicit_task: false, 
      task_name: "",
      task_phase_id: "",
      task_exclude_values: "",
    });
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
      task_phase_id: variable.task_phase_id || "",
      task_exclude_values: variable.task_exclude_values?.join(", ") || "",
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

      {/* Workload capacity configuration moved to WorkloadConfiguration page */}

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {variables.map((variable) => (
            <Card key={variable.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{variable.name}</CardTitle>
                  <div className="flex gap-2">
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
                  </div>
                </div>
                {variable.description && (
                  <CardDescription>{variable.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {variable.has_implicit_task ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-sm">
                      <span className="font-medium">Tarea implícita:</span>{' '}
                      {variable.task_name}
                    </div>
                    {variable.task_phase_id && (
                      <div className="text-sm">
                        <span className="font-medium">Fase:</span>{' '}
                        {phases.find(p => p.id === variable.task_phase_id)?.display_name || 'No especificada'}
                      </div>
                    )}
                    {variable.task_exclude_values && variable.task_exclude_values.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Excluir valores:</span>{' '}
                        {variable.task_exclude_values.join(', ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Sin tarea implícita</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
              <>
                <div>
                  <Label htmlFor="task-name">Nombre de la tarea</Label>
                  <Input
                    id="task-name"
                    value={formData.task_name}
                    onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                    placeholder="ej: Plastificado"
                  />
                </div>
                <div>
                  <Label htmlFor="task-phase">Fase de producción</Label>
                  <Select 
                    value={formData.task_phase_id} 
                    onValueChange={(value) => setFormData({ ...formData, task_phase_id: value })}
                  >
                    <SelectTrigger id="task-phase">
                      <SelectValue placeholder="Selecciona una fase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: phase.color }}
                            />
                            {phase.display_name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exclude-values">Valores que NO crean la tarea (separados por comas)</Label>
                  <Input
                    id="exclude-values"
                    value={formData.task_exclude_values}
                    onChange={(e) => setFormData({ ...formData, task_exclude_values: e.target.value })}
                    placeholder="ej: No, Sin plastificado"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Por defecto la tarea siempre se crea. Solo se evita si el valor coincide con alguna de estas excepciones</p>
                </div>
              </>
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
              <>
                <div>
                  <Label htmlFor="edit-task-name">Nombre de la tarea</Label>
                  <Input
                    id="edit-task-name"
                    value={formData.task_name}
                    onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                    placeholder="ej: Plastificado"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-task-phase">Fase de producción</Label>
                  <Select 
                    value={formData.task_phase_id} 
                    onValueChange={(value) => setFormData({ ...formData, task_phase_id: value })}
                  >
                    <SelectTrigger id="edit-task-phase">
                      <SelectValue placeholder="Selecciona una fase" />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: phase.color }}
                            />
                            {phase.display_name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-exclude-values">Valores que NO crean la tarea (separados por comas)</Label>
                  <Input
                    id="edit-exclude-values"
                    value={formData.task_exclude_values}
                    onChange={(e) => setFormData({ ...formData, task_exclude_values: e.target.value })}
                    placeholder="ej: No, Sin plastificado"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Por defecto la tarea siempre se crea. Solo se evita si el valor coincide con alguna de estas excepciones</p>
                </div>
              </>
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
