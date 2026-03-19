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
  sprint_ids: string[];
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

interface TaskSprintRow {
  task_id: string;
  sprint_id: string;
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

  // Fetch task-sprint associations
  const { data: taskSprints = [] } = useQuery({
    queryKey: ["development_task_sprints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_task_sprints")
        .select("task_id, sprint_id");

      if (error) throw error;
      return data as TaskSprintRow[];
    },
  });

  // Fetch all tasks and enrich with sprint_ids
  const { data: rawTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["development_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("development_tasks")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Combine tasks with their sprint associations
  const tasks: Task[] = rawTasks.map((t: any) => ({
    ...t,
    sprint_ids: taskSprints
      .filter((ts) => ts.task_id === t.id)
      .map((ts) => ts.sprint_id),
  }));

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
      queryClient.invalidateQueries({ queryKey: ["development_task_sprints"] });
      toast.success("Sprint eliminado");
    },
    onError: (error) => {
      toast.error("Error al eliminar sprint: " + error.message);
    },
  });

  // Create task with sprint associations
  const createTask = useMutation({
    mutationFn: async (task: Omit<Task, "id" | "created_at" | "updated_at">) => {
      const { sprint_ids, ...taskData } = task;
      const { data, error } = await supabase
        .from("development_tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      // Insert sprint associations
      if (sprint_ids && sprint_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("development_task_sprints")
          .insert(sprint_ids.map((sid) => ({ task_id: data.id, sprint_id: sid })));
        if (linkError) throw linkError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["development_task_sprints"] });
      toast.success("Objetivo creado correctamente");
    },
    onError: (error) => {
      toast.error("Error al crear objetivo: " + error.message);
    },
  });

  // Update task with sprint associations
  const updateTask = useMutation({
    mutationFn: async ({ id, sprint_ids, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from("development_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Replace sprint associations if provided
      if (sprint_ids !== undefined) {
        // Delete existing
        await supabase
          .from("development_task_sprints")
          .delete()
          .eq("task_id", id);

        // Insert new
        if (sprint_ids.length > 0) {
          const { error: linkError } = await supabase
            .from("development_task_sprints")
            .insert(sprint_ids.map((sid) => ({ task_id: id, sprint_id: sid })));
          if (linkError) throw linkError;
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["development_task_sprints"] });
    },
    onError: (error) => {
      toast.error("Error al actualizar objetivo: " + error.message);
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
      queryClient.invalidateQueries({ queryKey: ["development_task_sprints"] });
      toast.success("Objetivo eliminado");
    },
    onError: (error) => {
      toast.error("Error al eliminar objetivo: " + error.message);
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
      toast.error("Error al mover objetivo: " + error.message);
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
    const sprintTasks = tasks.filter((t) => t.sprint_ids.includes(sprintId));
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
