import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface DefaultProductionTask {
  id: string;
  organization_id: string;
  task_name: string;
  phase_id: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDefaultTaskData {
  task_name: string;
  phase_id: string;
  display_order?: number;
}

export interface UpdateDefaultTaskData {
  task_name?: string;
  phase_id?: string;
  display_order?: number;
  is_active?: boolean;
}

export function useDefaultProductionTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization } = useSubscription();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["default-production-tasks", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from("default_production_tasks")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Error fetching default tasks:", error);
        throw error;
      }

      return data as DefaultProductionTask[];
    },
    enabled: !!organization?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateDefaultTaskData) => {
      if (!organization?.id) throw new Error("No organization found");

      const { data: result, error } = await supabase
        .from("default_production_tasks")
        .insert({
          organization_id: organization.id,
          task_name: data.task_name,
          phase_id: data.phase_id,
          display_order: data.display_order || tasks.length,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-production-tasks"] });
      toast({
        title: "Tarea creada",
        description: "La tarea por defecto se ha creado correctamente",
      });
    },
    onError: (error) => {
      console.error("Error creating default task:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea por defecto",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateDefaultTaskData }) => {
      const { data, error } = await supabase
        .from("default_production_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-production-tasks"] });
      toast({
        title: "Tarea actualizada",
        description: "La tarea por defecto se ha actualizado correctamente",
      });
    },
    onError: (error) => {
      console.error("Error updating default task:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea por defecto",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("default_production_tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-production-tasks"] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea por defecto se ha eliminado correctamente",
      });
    },
    onError: (error) => {
      console.error("Error deleting default task:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la tarea por defecto",
        variant: "destructive",
      });
    },
  });

  return {
    tasks,
    isLoading,
    createTask: createMutation.mutate,
    updateTask: updateMutation.mutate,
    deleteTask: deleteMutation.mutate,
  };
}
