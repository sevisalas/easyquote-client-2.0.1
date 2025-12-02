import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Save, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDefaultProductionTasks } from "@/hooks/useDefaultProductionTasks";
import { useProductionPhases } from "@/hooks/useProductionPhases";
import { useProductionVariables } from "@/hooks/useProductionVariables";
import type { DefaultProductionTask } from "@/hooks/useDefaultProductionTasks";

export default function ProductionConfiguration() {
  const { organization } = useSubscription();
  const { toast } = useToast();
  
  // Workload Configuration
  const [maxDailyOrders, setMaxDailyOrders] = useState<number>(20);
  const [isSaving, setIsSaving] = useState(false);

  // Default Tasks
  const { tasks, isLoading: tasksLoading, createTask, updateTask, deleteTask } = useDefaultProductionTasks();
  const { phases, isLoading: phasesLoading } = useProductionPhases();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DefaultProductionTask | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    task_name: "",
    phase_id: "",
  });

  // Production Variables
  const {
    variables,
    isLoading: variablesLoading,
    createVariable,
    updateVariable,
    deleteVariable,
  } = useProductionVariables();
  const [isCreateVarDialogOpen, setIsCreateVarDialogOpen] = useState(false);
  const [isEditVarDialogOpen, setIsEditVarDialogOpen] = useState(false);
  const [isDeleteVarDialogOpen, setIsDeleteVarDialogOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<any>(null);
  const [varFormData, setVarFormData] = useState({
    name: "",
    description: "",
    variable_type: "alphanumeric",
    has_implicit_task: false,
    task_name: "",
    task_phase_id: "",
    task_exclude_values: [] as string[],
  });

  useEffect(() => {
    if (organization) {
      setMaxDailyOrders(organization.max_daily_orders || 20);
    }
  }, [organization]);

  const handleSaveWorkload = async () => {
    if (!organization) return;
    
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("organizations")
        .update({ max_daily_orders: maxDailyOrders })
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Capacidad actualizada",
        description: "La capacidad máxima diaria se ha guardado correctamente",
      });
    } catch (error) {
      console.error("Error updating capacity:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la capacidad",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTask = () => {
    createTask({
      task_name: taskFormData.task_name,
      phase_id: taskFormData.phase_id,
    });
    setIsCreateDialogOpen(false);
    setTaskFormData({ task_name: "", phase_id: "" });
  };

  const handleEditTask = () => {
    if (!selectedTask) return;
    updateTask({
      id: selectedTask.id,
      updates: {
        task_name: taskFormData.task_name,
        phase_id: taskFormData.phase_id,
      },
    });
    setIsEditDialogOpen(false);
    setSelectedTask(null);
    setTaskFormData({ task_name: "", phase_id: "" });
  };

  const handleDeleteTask = () => {
    if (!selectedTask) return;
    deleteTask(selectedTask.id);
    setIsDeleteDialogOpen(false);
    setSelectedTask(null);
  };

  const openEditTaskDialog = (task: DefaultProductionTask) => {
    setSelectedTask(task);
    setTaskFormData({
      task_name: task.task_name,
      phase_id: task.phase_id,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteTaskDialog = (task: DefaultProductionTask) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateVariable = () => {
    createVariable({
      name: varFormData.name,
      description: varFormData.description,
      variable_type: varFormData.variable_type,
      has_implicit_task: varFormData.has_implicit_task,
      task_name: varFormData.has_implicit_task ? varFormData.task_name : null,
      task_phase_id: varFormData.has_implicit_task ? varFormData.task_phase_id : null,
      task_exclude_values: varFormData.has_implicit_task ? varFormData.task_exclude_values : null,
    });
    setIsCreateVarDialogOpen(false);
    setVarFormData({
      name: "",
      description: "",
      variable_type: "",
      has_implicit_task: false,
      task_name: "",
      task_phase_id: "",
      task_exclude_values: [],
    });
  };

  const handleEditVariable = () => {
    if (!selectedVariable) return;
    updateVariable({
      id: selectedVariable.id,
      updates: {
        name: varFormData.name,
        description: varFormData.description,
        variable_type: varFormData.variable_type,
        has_implicit_task: varFormData.has_implicit_task,
        task_name: varFormData.has_implicit_task ? varFormData.task_name : null,
        task_phase_id: varFormData.has_implicit_task ? varFormData.task_phase_id : null,
        task_exclude_values: varFormData.has_implicit_task ? varFormData.task_exclude_values : null,
      },
    });
    setIsEditVarDialogOpen(false);
    setSelectedVariable(null);
    setVarFormData({
      name: "",
      description: "",
      variable_type: "",
      has_implicit_task: false,
      task_name: "",
      task_phase_id: "",
      task_exclude_values: [],
    });
  };

  const handleDeleteVariable = () => {
    if (!selectedVariable) return;
    deleteVariable(selectedVariable.id);
    setIsDeleteVarDialogOpen(false);
    setSelectedVariable(null);
  };

  const openEditVarDialog = (variable: any) => {
    setSelectedVariable(variable);
    setVarFormData({
      name: variable.name,
      description: variable.description || "",
      variable_type: variable.variable_type,
      has_implicit_task: variable.has_implicit_task,
      task_name: variable.task_name || "",
      task_phase_id: variable.task_phase_id || "",
      task_exclude_values: variable.task_exclude_values || [],
    });
    setIsEditVarDialogOpen(true);
  };

  const openDeleteVarDialog = (variable: any) => {
    setSelectedVariable(variable);
    setIsDeleteVarDialogOpen(true);
  };

  if (tasksLoading || phasesLoading || variablesLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Cargando configuración de producción...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Producción</h1>
        <p className="text-muted-foreground mt-2">
          Configura la capacidad, tareas por defecto y variables de producción
        </p>
      </div>

      {/* Top Row: Workload and Default Tasks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Workload Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Capacidad máxima diaria</CardTitle>
            <CardDescription>
              Pedidos máximos que tu equipo puede gestionar por día
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="max-capacity">Pedidos por día</Label>
                <Input
                  id="max-capacity"
                  type="number"
                  min="1"
                  value={maxDailyOrders}
                  onChange={(e) => setMaxDailyOrders(parseInt(e.target.value) || 1)}
                  className="mt-2"
                />
              </div>
              <Button 
                onClick={handleSaveWorkload} 
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Default Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tareas por defecto</CardTitle>
                <CardDescription>
                  Tareas que se crearán automáticamente
                </CardDescription>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nueva
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay tareas configuradas
              </p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const phase = phases.find(p => p.id === task.phase_id);
                  return (
                    <div key={task.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-2 flex-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{task.task_name}</div>
                          {phase && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: phase.color }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {phase.display_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditTaskDialog(task)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteTaskDialog(task)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Production Variables */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Variables de producción</h2>
            <p className="text-sm text-muted-foreground">
              Variables reutilizables para mapear a prompts y outputs de productos
            </p>
          </div>
          <Button onClick={() => setIsCreateVarDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva variable
          </Button>
        </div>
        
        {variables.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No hay variables de producción configuradas
              </p>
              <Button onClick={() => setIsCreateVarDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera variable
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {variables.map((variable) => (
              <Card key={variable.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{variable.name}</CardTitle>
                      {variable.description && (
                        <CardDescription className="mt-1">
                          {variable.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditVarDialog(variable)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteVarDialog(variable)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {variable.has_implicit_task && variable.task_name ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">Tarea:</span>{" "}
                          <span className="font-medium">{variable.task_name}</span>
                        </div>
                        {variable.task_phase_id && (
                          <div>
                            <span className="text-muted-foreground">Fase:</span>{" "}
                            <span>
                              {phases.find(p => p.id === variable.task_phase_id)?.display_name || 'N/A'}
                            </span>
                          </div>
                        )}
                        {variable.task_exclude_values && variable.task_exclude_values.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Excepciones:</span>{" "}
                            <span className="text-xs">
                              {variable.task_exclude_values.join(', ')}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground italic">
                        Sin tarea implícita configurada
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Task Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva tarea por defecto</DialogTitle>
            <DialogDescription>
              Esta tarea se creará automáticamente para todos los trabajos nuevos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-name">Nombre de la tarea</Label>
              <Input
                id="task-name"
                value={taskFormData.task_name}
                onChange={(e) => setTaskFormData({ ...taskFormData, task_name: e.target.value })}
                placeholder="ej: Preparación, Impresión"
              />
            </div>
            <div>
              <Label htmlFor="phase">Fase de producción</Label>
              <Select 
                value={taskFormData.phase_id} 
                onValueChange={(value) => setTaskFormData({ ...taskFormData, phase_id: value })}
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
              onClick={handleCreateTask} 
              disabled={!taskFormData.task_name.trim() || !taskFormData.phase_id}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tarea por defecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-task-name">Nombre de la tarea</Label>
              <Input
                id="edit-task-name"
                value={taskFormData.task_name}
                onChange={(e) => setTaskFormData({ ...taskFormData, task_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phase">Fase de producción</Label>
              <Select 
                value={taskFormData.phase_id} 
                onValueChange={(value) => setTaskFormData({ ...taskFormData, phase_id: value })}
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
              onClick={handleEditTask}
              disabled={!taskFormData.task_name.trim() || !taskFormData.phase_id}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea por defecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta tarea ya no se creará automáticamente en los nuevos trabajos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Variable Create Dialog */}
      <Dialog open={isCreateVarDialogOpen} onOpenChange={setIsCreateVarDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva variable de producción</DialogTitle>
            <DialogDescription>
              Crea una variable reutilizable para mapear a productos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="var-name">Nombre</Label>
              <Input
                id="var-name"
                value={varFormData.name}
                onChange={(e) => setVarFormData({ ...varFormData, name: e.target.value })}
                placeholder="ej: Cantidad de ejemplares"
              />
            </div>
            <div>
              <Label htmlFor="var-desc">Descripción (opcional)</Label>
              <Input
                id="var-desc"
                value={varFormData.description}
                onChange={(e) => setVarFormData({ ...varFormData, description: e.target.value })}
                placeholder="Describe el propósito de esta variable"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-implicit-task"
                checked={varFormData.has_implicit_task}
                onCheckedChange={(checked) => setVarFormData({ ...varFormData, has_implicit_task: checked as boolean })}
              />
              <Label htmlFor="has-implicit-task">Tiene tarea implícita</Label>
            </div>
            
            {varFormData.has_implicit_task && (
              <>
                <div>
                  <Label htmlFor="task-name">Nombre de la tarea</Label>
                  <Input
                    id="task-name"
                    value={varFormData.task_name}
                    onChange={(e) => setVarFormData({ ...varFormData, task_name: e.target.value })}
                    placeholder="ej: Plastificar"
                  />
                </div>
                
                <div>
                  <Label htmlFor="task-phase">Fase de producción</Label>
                  <Select 
                    value={varFormData.task_phase_id} 
                    onValueChange={(value) => setVarFormData({ ...varFormData, task_phase_id: value })}
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
                  <Label htmlFor="exclude-values">Valores de exclusión (separados por comas)</Label>
                  <Input
                    id="exclude-values"
                    value={varFormData.task_exclude_values.join(', ')}
                    onChange={(e) => setVarFormData({ 
                      ...varFormData, 
                      task_exclude_values: e.target.value.split(',').map(v => v.trim()).filter(v => v) 
                    })}
                    placeholder="ej: No, Ninguno, Sin plastificar"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateVarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateVariable} 
              disabled={!varFormData.name.trim()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variable Edit Dialog */}
      <Dialog open={isEditVarDialogOpen} onOpenChange={setIsEditVarDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar variable de producción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-var-name">Nombre</Label>
              <Input
                id="edit-var-name"
                value={varFormData.name}
                onChange={(e) => setVarFormData({ ...varFormData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-var-desc">Descripción (opcional)</Label>
              <Input
                id="edit-var-desc"
                value={varFormData.description}
                onChange={(e) => setVarFormData({ ...varFormData, description: e.target.value })}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-has-implicit-task"
                checked={varFormData.has_implicit_task}
                onCheckedChange={(checked) => setVarFormData({ ...varFormData, has_implicit_task: checked as boolean })}
              />
              <Label htmlFor="edit-has-implicit-task">Tiene tarea implícita</Label>
            </div>
            
            {varFormData.has_implicit_task && (
              <>
                <div>
                  <Label htmlFor="edit-task-name">Nombre de la tarea</Label>
                  <Input
                    id="edit-task-name"
                    value={varFormData.task_name}
                    onChange={(e) => setVarFormData({ ...varFormData, task_name: e.target.value })}
                    placeholder="ej: Plastificar"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-task-phase">Fase de producción</Label>
                  <Select 
                    value={varFormData.task_phase_id} 
                    onValueChange={(value) => setVarFormData({ ...varFormData, task_phase_id: value })}
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
                  <Label htmlFor="edit-exclude-values">Valores de exclusión (separados por comas)</Label>
                  <Input
                    id="edit-exclude-values"
                    value={varFormData.task_exclude_values.join(', ')}
                    onChange={(e) => setVarFormData({ 
                      ...varFormData, 
                      task_exclude_values: e.target.value.split(',').map(v => v.trim()).filter(v => v) 
                    })}
                    placeholder="ej: No, Ninguno, Sin plastificar"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditVarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEditVariable}
              disabled={!varFormData.name.trim()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variable Delete Dialog */}
      <AlertDialog open={isDeleteVarDialogOpen} onOpenChange={setIsDeleteVarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar variable?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta variable dejará de estar disponible para mapear a productos. Los mapeos existentes se mantendrán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVariable}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
