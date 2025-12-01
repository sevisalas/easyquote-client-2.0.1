import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface ProductVariableMapping {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  product_name: string;
  prompt_or_output_name: string;
  production_variable_id: string;
  created_at: string;
  updated_at: string;
}

export function useProductVariableMappings(easyquoteProductId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization } = useSubscription();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["product-variable-mappings", organization?.id, easyquoteProductId],
    queryFn: async () => {
      if (!organization?.id || !easyquoteProductId) return [];
      
      const { data, error } = await supabase
        .from("product_variable_mappings")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("easyquote_product_id", easyquoteProductId);

      if (error) throw error;
      return data as ProductVariableMapping[];
    },
    enabled: !!organization?.id && !!easyquoteProductId,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      easyquoteProductId,
      productName,
      promptOrOutputName,
      variableId,
    }: {
      easyquoteProductId: string;
      productName: string;
      promptOrOutputName: string;
      variableId: string | null;
    }) => {
      if (!organization?.id) {
        throw new Error("No organization found");
      }

      // Si variableId es null, eliminar el mapeo
      if (!variableId) {
        const { error } = await supabase
          .from("product_variable_mappings")
          .delete()
          .eq("organization_id", organization.id)
          .eq("easyquote_product_id", easyquoteProductId)
          .eq("prompt_or_output_name", promptOrOutputName);

        if (error) throw error;
        return null;
      }

      // Insertar o actualizar el mapeo
      const { data, error } = await supabase
        .from("product_variable_mappings")
        .upsert(
          {
            organization_id: organization.id,
            easyquote_product_id: easyquoteProductId,
            product_name: productName,
            prompt_or_output_name: promptOrOutputName,
            production_variable_id: variableId,
          },
          {
            onConflict: "organization_id,easyquote_product_id,prompt_or_output_name",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-variable-mappings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al guardar mapeo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({
      easyquoteProductId,
      promptOrOutputName,
    }: {
      easyquoteProductId: string;
      promptOrOutputName: string;
    }) => {
      if (!organization?.id) {
        throw new Error("No organization found");
      }

      const { error } = await supabase
        .from("product_variable_mappings")
        .delete()
        .eq("organization_id", organization.id)
        .eq("easyquote_product_id", easyquoteProductId)
        .eq("prompt_or_output_name", promptOrOutputName);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-variable-mappings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar mapeo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Función auxiliar para obtener el ID de variable mapeado para un prompt/output específico
  const getMappedVariableId = (promptOrOutputName: string): string | null => {
    const mapping = mappings?.find(
      (m) => m.prompt_or_output_name === promptOrOutputName
    );
    return mapping?.production_variable_id || null;
  };

  // Función auxiliar para obtener los nombres de prompts/outputs ya mapeados
  const getMappedNames = (): string[] => {
    return mappings?.map((m) => m.prompt_or_output_name) || [];
  };

  return {
    mappings: mappings || [],
    isLoading,
    upsertMapping: upsertMutation.mutate,
    deleteMapping: deleteMutation.mutate,
    getMappedVariableId,
    getMappedNames,
  };
}
