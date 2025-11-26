import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductionTask {
  id: string;
  sales_order_item_id: string;
  phase_id: string;
  task_name: string;
  operator_id: string;
  operator_name?: string; // Nombre del operador desde profiles
  status: "pending" | "in_progress" | "paused" | "completed";
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  total_time_seconds: number;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductionTaskData {
  sales_order_item_id: string;
  phase_id: string;
  task_name: string;
  operator_id: string;
}

export interface UpdateProductionTaskData {
  status?: "pending" | "in_progress" | "paused" | "completed";
  started_at?: string | null;
  paused_at?: string | null;
  completed_at?: string | null;
  total_time_seconds?: number;
  comments?: string | null;
}

export function useProductionTasks(itemId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch tasks for a specific item
  const { data: tasks = [], refetch } = useQuery({
    queryKey: ["production-tasks", itemId],
    queryFn: async () => {
      if (!itemId) return [];

      // Primero obtenemos las tareas
      const { data: tasksData, error: tasksError } = await supabase
        .from("production_tasks")
        .select("*")
        .eq("sales_order_item_id", itemId)
        .order("created_at", { ascending: false });

      if (tasksError) {
        console.error("Error fetching production tasks:", tasksError);
        throw tasksError;
      }

      if (!tasksData || tasksData.length === 0) {
        return [];
      }

      // Luego obtenemos los perfiles de los operadores
      const operatorIds = [...new Set(tasksData.map(t => t.operator_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", operatorIds);

      // Crear un mapa de operadores
      const operatorsMap = new Map(
        (profilesData || []).map(p => [
          p.user_id,
          `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Usuario'
        ])
      );

      // Combinar los datos
      return tasksData.map((task: any) => ({
        ...task,
        operator_name: operatorsMap.get(task.operator_id) || 'Usuario',
      })) as ProductionTask[];
    },
    enabled: !!itemId,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateProductionTaskData) => {
      const { data, error } = await supabase
        .from("production_tasks")
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
      toast({
        title: "Tarea creada",
        description: "La tarea de producción se ha creado correctamente",
      });
    },
    onError: (error) => {
      console.error("Error creating production task:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea de producción",
        variant: "destructive",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: UpdateProductionTaskData;
    }) => {
      const { data, error } = await supabase
        .from("production_tasks")
        .update(updates)
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
    },
    onError: (error) => {
      console.error("Error updating production task:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("production_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-tasks"] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea de producción se ha eliminado correctamente",
      });
    },
    onError: (error) => {
      console.error("Error deleting production task:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la tarea",
        variant: "destructive",
      });
    },
  });

  const createTask = async (taskData: CreateProductionTaskData) => {
    setIsLoading(true);
    try {
      await createTaskMutation.mutateAsync(taskData);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTask = async (taskId: string, updates: UpdateProductionTaskData) => {
    await updateTaskMutation.mutateAsync({ taskId, updates });
  };

  const deleteTask = async (taskId: string) => {
    await deleteTaskMutation.mutateAsync(taskId);
  };

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    refetch,
  };
}
