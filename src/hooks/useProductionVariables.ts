import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface ProductionVariable {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  variable_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductionVariableData {
  name: string;
  description?: string;
  variable_type?: string;
}

export interface UpdateProductionVariableData {
  name?: string;
  description?: string;
  variable_type?: string;
  is_active?: boolean;
}

export function useProductionVariables() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization } = useSubscription();

  const { data: variables, isLoading } = useQuery({
    queryKey: ["production-variables", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from("production_variables")
        .select("*")
        .eq("organization_id", organization.id)
        .order("name");

      if (error) throw error;
      return data as ProductionVariable[];
    },
    enabled: !!organization?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (newVariable: CreateProductionVariableData) => {
      if (!organization?.id) {
        throw new Error("No organization found");
      }

      const { data, error } = await supabase
        .from("production_variables")
        .insert({
          organization_id: organization.id,
          name: newVariable.name,
          description: newVariable.description,
          variable_type: newVariable.variable_type || "alphanumeric",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-variables"] });
      toast({
        title: "Variable creada",
        description: "La variable de producción se ha creado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear variable",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateProductionVariableData;
    }) => {
      const { data, error } = await supabase
        .from("production_variables")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-variables"] });
      toast({
        title: "Variable actualizada",
        description: "La variable de producción se ha actualizado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar variable",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("production_variables")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-variables"] });
      toast({
        title: "Variable eliminada",
        description: "La variable de producción se ha eliminado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar variable",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    variables: variables || [],
    isLoading,
    createVariable: createMutation.mutate,
    updateVariable: updateMutation.mutate,
    deleteVariable: deleteMutation.mutate,
  };
}
