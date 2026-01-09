import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useRoadmap, Task, Sprint, TaskCategory, TaskPriority, TaskStatus } from "@/hooks/useRoadmap";
import { RoadmapKanban } from "@/components/roadmap/RoadmapKanban";
import { RoadmapFilters } from "@/components/roadmap/RoadmapFilters";
import { SprintCard } from "@/components/roadmap/SprintCard";
import { TaskDialog } from "@/components/roadmap/TaskDialog";
import { SprintDialog } from "@/components/roadmap/SprintDialog";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, LayoutList, Calendar } from "lucide-react";

const SuperAdminRoadmap = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useSubscription();
  const {
    sprints,
    tasks,
    isLoading,
    createSprint,
    updateSprint,
    deleteSprint,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    getSprintStats,
  } = useRoadmap();

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [sprintFilter, setSprintFilter] = useState("all");

  // Dialogs
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [sprintDialogOpen, setSprintDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteSprintId, setDeleteSprintId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Roadmap | EasyQuote SuperAdmin";
    if (!isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, navigate]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== "all" && task.category !== categoryFilter) {
        return false;
      }
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }
      if (sprintFilter === "none" && task.sprint_id !== null) {
        return false;
      }
      if (sprintFilter !== "all" && sprintFilter !== "none" && task.sprint_id !== sprintFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, search, categoryFilter, priorityFilter, sprintFilter]);

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setSprintFilter("all");
  };

  // Handlers
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleEditSprint = (sprint: Sprint) => {
    setEditingSprint(sprint);
    setSprintDialogOpen(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (taskData.id) {
      await updateTask.mutateAsync({ id: taskData.id, ...taskData });
    } else {
      await createTask.mutateAsync(taskData as Omit<Task, "id" | "created_at" | "updated_at">);
    }
    setTaskDialogOpen(false);
    setEditingTask(null);
  };

  const handleSaveSprint = async (sprintData: Partial<Sprint>) => {
    if (sprintData.id) {
      await updateSprint.mutateAsync({ id: sprintData.id, ...sprintData });
    } else {
      await createSprint.mutateAsync(sprintData as Omit<Sprint, "id" | "created_at" | "updated_at">);
    }
    setSprintDialogOpen(false);
    setEditingSprint(null);
  };

  const handleDeleteTask = async () => {
    if (deleteTaskId) {
      await deleteTask.mutateAsync(deleteTaskId);
      setDeleteTaskId(null);
    }
  };

  const handleDeleteSprint = async () => {
    if (deleteSprintId) {
      await deleteSprint.mutateAsync(deleteSprintId);
      setDeleteSprintId(null);
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: TaskStatus) => {
    await updateTaskStatus.mutateAsync({ id: taskId, status });
  };

  // Stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const activeSprint = sprints.find((s) => s.status === "active");

  if (!isSuperAdmin) return null;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-secondary/5 via-background to-secondary/10 px-6 py-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Roadmap de Desarrollo</h1>
            <p className="text-muted-foreground">
              Gestiona sprints y tareas del backlog de desarrollo
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingSprint(null);
                setSprintDialogOpen(true);
              }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Nuevo Sprint
            </Button>
            <Button
              onClick={() => {
                setEditingTask(null);
                setTaskDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Tarea
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg p-4 border">
            <p className="text-sm text-muted-foreground">Total tareas</p>
            <p className="text-2xl font-bold">{totalTasks}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border">
            <p className="text-sm text-muted-foreground">Completadas</p>
            <p className="text-2xl font-bold text-green-600">{doneTasks}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border">
            <p className="text-sm text-muted-foreground">Sprint activo</p>
            <p className="text-lg font-semibold truncate">
              {activeSprint?.name || "Ninguno"}
            </p>
          </div>
          <div className="bg-card rounded-lg p-4 border">
            <p className="text-sm text-muted-foreground">Sprints</p>
            <p className="text-2xl font-bold">{sprints.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="kanban" className="space-y-4">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-2">
              <LayoutList className="h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="sprints" className="gap-2">
              <Calendar className="h-4 w-4" />
              Sprints
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="space-y-4">
            <RoadmapFilters
              search={search}
              onSearchChange={setSearch}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              priorityFilter={priorityFilter}
              onPriorityChange={setPriorityFilter}
              sprintFilter={sprintFilter}
              onSprintChange={setSprintFilter}
              sprints={sprints}
              onClearFilters={clearFilters}
            />

            {isLoading ? (
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="w-72 h-96 flex-shrink-0" />
                ))}
              </div>
            ) : (
              <RoadmapKanban
                tasks={filteredTasks}
                sprints={sprints}
                onTaskStatusChange={handleTaskStatusChange}
                onEditTask={handleEditTask}
                onDeleteTask={setDeleteTaskId}
              />
            )}
          </TabsContent>

          <TabsContent value="sprints">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : sprints.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay sprints creados</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setEditingSprint(null);
                    setSprintDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer sprint
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    stats={getSprintStats(sprint.id)}
                    onEdit={handleEditSprint}
                    onDelete={setDeleteSprintId}
                    onViewTasks={(sprintId) => {
                      setSprintFilter(sprintId);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        sprints={sprints}
        onSave={handleSaveTask}
        isLoading={createTask.isPending || updateTask.isPending}
      />

      {/* Sprint Dialog */}
      <SprintDialog
        open={sprintDialogOpen}
        onOpenChange={setSprintDialogOpen}
        sprint={editingSprint}
        onSave={handleSaveSprint}
        isLoading={createSprint.isPending || updateSprint.isPending}
      />

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La tarea será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Sprint Confirmation */}
      <AlertDialog open={!!deleteSprintId} onOpenChange={() => setDeleteSprintId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              Las tareas asignadas a este sprint quedarán sin sprint asignado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSprint} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminRoadmap;
