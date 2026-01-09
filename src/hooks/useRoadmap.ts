import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SprintStatus = "planning" | "active" | "completed";
export type TaskCategory = "integration" | "feature" | "improvement" | "bugfix" | "infrastructure";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "testing" | "done";

export interface Sprint {
  id: string;
  name: string;
  description: string | null;
  status: SprintStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  sprint_id: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_hours: number | null;
  actual_hours: number | null;
  notes: string | null;
  related_version: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SprintWithTasks extends Sprint {
  tasks: Task[];
}

export const useRoadmap = () => {
  const queryClient = useQueryClient();

  // Fetch all sprints
  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["development_sprints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_sprints")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Sprint[];
    },
  });

  // Fetch all tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["development_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_tasks")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Task[];
    },
  });

  // Create sprint
  const createSprint = useMutation({
    mutationFn: async (sprint: Omit<Sprint, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("development_sprints")
        .insert(sprint)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_sprints"] });
      toast.success("Sprint creado correctamente");
    },
    onError: (error) => {
      toast.error("Error al crear sprint: " + error.message);
    },
  });

  // Update sprint
  const updateSprint = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Sprint> & { id: string }) => {
      const { data, error } = await supabase
        .from("development_sprints")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_sprints"] });
      toast.success("Sprint actualizado");
    },
    onError: (error) => {
      toast.error("Error al actualizar sprint: " + error.message);
    },
  });

  // Delete sprint
  const deleteSprint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("development_sprints")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_sprints"] });
      toast.success("Sprint eliminado");
    },
    onError: (error) => {
      toast.error("Error al eliminar sprint: " + error.message);
    },
  });

  // Create task
  const createTask = useMutation({
    mutationFn: async (task: Omit<Task, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("development_tasks")
        .insert(task)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_tasks"] });
      toast.success("Tarea creada correctamente");
    },
    onError: (error) => {
      toast.error("Error al crear tarea: " + error.message);
    },
  });

  // Update task
  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from("development_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_tasks"] });
    },
    onError: (error) => {
      toast.error("Error al actualizar tarea: " + error.message);
    },
  });

  // Delete task
  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("development_tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_tasks"] });
      toast.success("Tarea eliminada");
    },
    onError: (error) => {
      toast.error("Error al eliminar tarea: " + error.message);
    },
  });

  // Update task status (for drag and drop)
  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { data, error } = await supabase
        .from("development_tasks")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_tasks"] });
    },
    onError: (error) => {
      toast.error("Error al mover tarea: " + error.message);
    },
  });

  // Get tasks grouped by status
  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((task) => task.status === status);
  };

  // Get active sprint
  const activeSprint = sprints.find((s) => s.status === "active");

  // Get sprint stats
  const getSprintStats = (sprintId: string) => {
    const sprintTasks = tasks.filter((t) => t.sprint_id === sprintId);
    const doneTasks = sprintTasks.filter((t) => t.status === "done");
    return {
      total: sprintTasks.length,
      done: doneTasks.length,
      progress: sprintTasks.length > 0 ? Math.round((doneTasks.length / sprintTasks.length) * 100) : 0,
    };
  };

  return {
    sprints,
    tasks,
    activeSprint,
    isLoading: sprintsLoading || tasksLoading,
    createSprint,
    updateSprint,
    deleteSprint,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    getTasksByStatus,
    getSprintStats,
  };
};
