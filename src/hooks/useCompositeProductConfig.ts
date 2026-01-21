import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types based on database schema
export interface CompositePrompt {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  name: string;
  label: string;
  type: string;
  default_value: string | null;
  options: { label: string; value: string }[] | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompositeOutput {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  name: string;
  label: string;
  type: string;
  formula: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompositeComponent {
  id: string;
  organization_id: string;
  composite_product_id: string;
  component_product_id: string;
  component_alias: string;
  display_order: number;
  is_optional: boolean;
  created_at: string;
  updated_at: string;
}

export const PROMPT_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Desplegable" },
] as const;

export const OUTPUT_TYPES = [
  { value: "price", label: "Precio" },
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
] as const;

export function useCompositeProductConfig(easyquoteProductId?: string) {
  const queryClient = useQueryClient();

  // Get organization ID
  const { data: userRole } = useQuery({
    queryKey: ["current-user-role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_user_role");
      if (error) throw error;
      return data?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const organizationId = userRole?.organization_id;

  // Fetch prompts (inputs) for composite product
  const {
    data: prompts = [],
    isLoading: promptsLoading,
    refetch: refetchPrompts,
  } = useQuery({
    queryKey: ["composite-prompts", easyquoteProductId, organizationId],
    queryFn: async () => {
      if (!easyquoteProductId || !organizationId) return [];
      const { data, error } = await supabase
        .from("composite_product_prompts")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("easyquote_product_id", easyquoteProductId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CompositePrompt[];
    },
    enabled: !!easyquoteProductId && !!organizationId,
  });

  // Fetch outputs for composite product
  const {
    data: outputs = [],
    isLoading: outputsLoading,
    refetch: refetchOutputs,
  } = useQuery({
    queryKey: ["composite-outputs", easyquoteProductId, organizationId],
    queryFn: async () => {
      if (!easyquoteProductId || !organizationId) return [];
      const { data, error } = await supabase
        .from("composite_product_outputs")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("easyquote_product_id", easyquoteProductId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CompositeOutput[];
    },
    enabled: !!easyquoteProductId && !!organizationId,
  });

  // Fetch components for composite product
  const {
    data: components = [],
    isLoading: componentsLoading,
    refetch: refetchComponents,
  } = useQuery({
    queryKey: ["composite-components", easyquoteProductId, organizationId],
    queryFn: async () => {
      if (!easyquoteProductId || !organizationId) return [];
      const { data, error } = await supabase
        .from("composite_product_components")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("composite_product_id", easyquoteProductId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CompositeComponent[];
    },
    enabled: !!easyquoteProductId && !!organizationId,
  });

  // Add prompt mutation
  const addPromptMutation = useMutation({
    mutationFn: async (prompt: Omit<CompositePrompt, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("composite_product_prompts")
        .insert(prompt)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompts", easyquoteProductId] });
    },
  });

  // Update prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompositePrompt> & { id: string }) => {
      const { data, error } = await supabase
        .from("composite_product_prompts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompts", easyquoteProductId] });
    },
  });

  // Delete prompt mutation
  const deletePromptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("composite_product_prompts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompts", easyquoteProductId] });
    },
  });

  // Add output mutation
  const addOutputMutation = useMutation({
    mutationFn: async (output: Omit<CompositeOutput, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("composite_product_outputs")
        .insert(output)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-outputs", easyquoteProductId] });
    },
  });

  // Update output mutation
  const updateOutputMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompositeOutput> & { id: string }) => {
      const { data, error } = await supabase
        .from("composite_product_outputs")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-outputs", easyquoteProductId] });
    },
  });

  // Delete output mutation
  const deleteOutputMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("composite_product_outputs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-outputs", easyquoteProductId] });
    },
  });

  return {
    // Data
    prompts,
    outputs,
    components,
    organizationId,

    // Loading states
    promptsLoading,
    outputsLoading,
    componentsLoading,
    isLoading: promptsLoading || outputsLoading || componentsLoading,

    // Refetch
    refetchPrompts,
    refetchOutputs,
    refetchComponents,

    // Prompt mutations
    addPrompt: addPromptMutation.mutateAsync,
    updatePrompt: updatePromptMutation.mutateAsync,
    deletePrompt: deletePromptMutation.mutateAsync,
    isAddingPrompt: addPromptMutation.isPending,
    isUpdatingPrompt: updatePromptMutation.isPending,
    isDeletingPrompt: deletePromptMutation.isPending,

    // Output mutations
    addOutput: addOutputMutation.mutateAsync,
    updateOutput: updateOutputMutation.mutateAsync,
    deleteOutput: deleteOutputMutation.mutateAsync,
    isAddingOutput: addOutputMutation.isPending,
    isUpdatingOutput: updateOutputMutation.isPending,
    isDeletingOutput: deleteOutputMutation.isPending,
  };
}
