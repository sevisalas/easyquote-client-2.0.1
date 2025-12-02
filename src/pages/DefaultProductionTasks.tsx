import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDefaultProductionTasks } from "@/hooks/useDefaultProductionTasks";
import type { DefaultProductionTask } from "@/hooks/useDefaultProductionTasks";
import { useProductionPhases } from "@/hooks/useProductionPhases";

export default function DefaultProductionTasks() {
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useDefaultProductionTasks();
  const { phases, isLoading: phasesLoading } = useProductionPhases();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DefaultProductionTask | null>(null);
  const [formData, setFormData] = useState({
    task_name: "",
    phase_id: "",
  });

  const handleCreate = () => {
    createTask({
      task_name: formData.task_name,
      phase_id: formData.phase_id,
    });
    setIsCreateDialogOpen(false);
    setFormData({ task_name: "", phase_id: "" });
  };

  const handleEdit = () => {
    if (!selectedTask) return;
    updateTask({
      id: selectedTask.id,
      updates: {
        task_name: formData.task_name,
        phase_id: formData.phase_id,
      },
    });
    setIsEditDialogOpen(false);
    setSelectedTask(null);
    setFormData({ task_name: "", phase_id: "" });
  };

  const handleDelete = () => {
    if (!selectedTask) return;
    deleteTask(selectedTask.id);
    setIsDeleteDialogOpen(false);
    setSelectedTask(null);
  };

  const openEditDialog = (task: DefaultProductionTask) => {
    setSelectedTask(task);
    setFormData({
      task_name: task.task_name,
      phase_id: task.phase_id,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (task: DefaultProductionTask) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading || phasesLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Cargando tareas por defecto...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tareas por defecto</h1>
          <p className="text-muted-foreground mt-2">
            Define las tareas que se crearán automáticamente para todos los trabajos de impresión
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva tarea
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No hay tareas por defecto configuradas
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primera tarea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const phase = phases.find(p => p.id === task.phase_id);
            return (
              <Card key={task.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{task.task_name}</div>
                      {phase && (
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: phase.color }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {phase.display_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(task)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(task)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva tarea por defecto</DialogTitle>
            <DialogDescription>
              Esta tarea se creará automáticamente para todos los trabajos de impresión nuevos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-name">Nombre de la tarea</Label>
              <Input
                id="task-name"
                value={formData.task_name}
                onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                placeholder="ej: Preparación, Impresión, Empaquetado"
              />
            </div>
            <div>
              <Label htmlFor="phase">Fase de producción</Label>
              <Select 
                value={formData.phase_id} 
                onValueChange={(value) => setFormData({ ...formData, phase_id: value })}
              >
                <SelectTrigger id="phase">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!formData.task_name.trim() || !formData.phase_id}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tarea por defecto</DialogTitle>
            <DialogDescription>
              Modifica los datos de la tarea
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-task-name">Nombre de la tarea</Label>
              <Input
                id="edit-task-name"
                value={formData.task_name}
                onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phase">Fase de producción</Label>
              <Select 
                value={formData.phase_id} 
                onValueChange={(value) => setFormData({ ...formData, phase_id: value })}
              >
                <SelectTrigger id="edit-phase">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEdit}
              disabled={!formData.task_name.trim() || !formData.phase_id}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea por defecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta tarea ya no se creará automáticamente en los nuevos trabajos.
              Las tareas ya creadas en pedidos existentes no se verán afectadas.
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
