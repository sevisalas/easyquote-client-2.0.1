import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Types based on database schema
export interface CompositePrompt {
  id: string;
  organization_id: string;
  api_user_id?: string;
  easyquote_product_id: string;
  name: string;
  label: string;
  type: string;
  default_value: string | null;
  // In DB this is Json; we keep it permissive to avoid type mismatches.
  options: any | null;
  is_required: boolean;
  is_hidden: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompositeOutput {
  id: string;
  organization_id: string;
  api_user_id?: string;
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
  api_user_id?: string;
  composite_product_id: string;
  component_product_id: string;
  component_alias: string;
  display_order: number;
  is_optional: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptConnection {
  id: string;
  organization_id: string;
  api_user_id?: string;
  composite_product_id: string;
  source_prompt_name: string;
  target_component_id: string;
  target_prompt_name: string;
  transform_formula: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutputAggregation {
  id: string;
  organization_id: string;
  api_user_id?: string;
  composite_product_id: string;
  source_output_name: string;
  target_output_name: string;
  target_output_label: string;
  aggregation_type: string;
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

export function useCompositeProductConfig(
  easyquoteProductId?: string,
  organizationIdOverride?: string
) {
  const queryClient = useQueryClient();

  type DbCompositePromptInsert = Database["public"]["Tables"]["composite_product_prompts"]["Insert"];
  type DbCompositeOutputInsert = Database["public"]["Tables"]["composite_product_outputs"]["Insert"];
  type DbCompositeComponentInsert = Database["public"]["Tables"]["composite_product_components"]["Insert"];
  type DbPromptConnectionInsert = Database["public"]["Tables"]["composite_prompt_connections"]["Insert"];
  type DbOutputAggregationInsert = Database["public"]["Tables"]["composite_output_aggregations"]["Insert"];

  // Get organization ID
  const shouldFetchUserRole = !organizationIdOverride;
  const { data: userRole } = useQuery({
    queryKey: ["current-user-role"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_user_role");
      if (error) throw error;
      return data?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: shouldFetchUserRole,
  });

  const organizationId = organizationIdOverride ?? userRole?.organization_id;

  // IMPORTANT: composite configuration must be shared by api_user_id across orgs
  // that use the same EasyQuote API user.
  const { data: apiUserId } = useQuery({
    queryKey: ["organization-api-user-id", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("api_user_id")
        .eq("id", organizationId)
        .single();
      if (error) throw error;
      return data?.api_user_id ?? null;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch prompts (inputs) for composite product
  const {
    data: prompts = [],
    isLoading: promptsLoading,
    refetch: refetchPrompts,
  } = useQuery({
    queryKey: ["composite-prompts", easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];
      const { data, error } = await supabase
        .from("composite_product_prompts")
        .select("*")
        .eq("api_user_id", apiUserId)
        .eq("easyquote_product_id", easyquoteProductId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CompositePrompt[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
  });

  // Fetch outputs for composite product
  const {
    data: outputs = [],
    isLoading: outputsLoading,
    refetch: refetchOutputs,
  } = useQuery({
    queryKey: ["composite-outputs", easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];
      const { data, error } = await supabase
        .from("composite_product_outputs")
        .select("*")
        .eq("api_user_id", apiUserId)
        .eq("easyquote_product_id", easyquoteProductId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CompositeOutput[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
  });

  // Fetch components for composite product
  const {
    data: components = [],
    isLoading: componentsLoading,
    refetch: refetchComponents,
  } = useQuery({
    queryKey: ["composite-components", easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];
      const { data, error } = await supabase
        .from("composite_product_components")
        .select("*")
        .eq("api_user_id", apiUserId)
        .eq("composite_product_id", easyquoteProductId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CompositeComponent[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
  });

  // Fetch prompt connections for composite product
  const {
    data: promptConnections = [],
    isLoading: connectionsLoading,
    refetch: refetchConnections,
  } = useQuery({
    queryKey: ["composite-prompt-connections", easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];
      const { data, error } = await supabase
        .from("composite_prompt_connections")
        .select("*")
        .eq("api_user_id", apiUserId)
        .eq("composite_product_id", easyquoteProductId);
      if (error) throw error;
      return (data || []) as PromptConnection[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
  });

  // Fetch output aggregations for composite product
  const {
    data: outputAggregations = [],
    isLoading: aggregationsLoading,
    refetch: refetchAggregations,
  } = useQuery({
    queryKey: ["composite-output-aggregations", easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];
      const { data, error } = await supabase
        .from("composite_output_aggregations")
        .select("*")
        .eq("api_user_id", apiUserId)
        .eq("composite_product_id", easyquoteProductId);
      if (error) throw error;
      return (data || []) as OutputAggregation[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
  });

  // Fetch all available component products (products with is_component=true)
  const {
    data: availableComponentProducts = [],
    isLoading: availableComponentsLoading,
  } = useQuery({
    queryKey: ["available-component-products", apiUserId],
    queryFn: async () => {
      if (!apiUserId) return [];
      const { data, error } = await supabase
        .from("product_component_settings")
        .select("easyquote_product_id")
        .eq("api_user_id", apiUserId)
        .eq("is_component", true);
      if (error) throw error;
      return (data || []).map((d) => d.easyquote_product_id);
    },
    enabled: !!apiUserId,
  });

  // Add prompt mutation
  const addPromptMutation = useMutation({
    mutationFn: async (prompt: Omit<CompositePrompt, "id" | "created_at" | "updated_at" | "api_user_id">) => {
      if (!organizationId || !apiUserId) throw new Error("Missing organization context");
      const payload: DbCompositePromptInsert = {
        ...prompt,
        organization_id: organizationId,
        api_user_id: apiUserId,
      };
      const { data, error } = await supabase
        .from("composite_product_prompts")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompts", easyquoteProductId, apiUserId] });
    },
  });

  // Update prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompositePrompt> & { id: string }) => {
      const { data, error } = await supabase
        .from("composite_product_prompts")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompts", easyquoteProductId, apiUserId] });
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
      queryClient.invalidateQueries({ queryKey: ["composite-prompts", easyquoteProductId, apiUserId] });
    },
  });

  // Add output mutation
  const addOutputMutation = useMutation({
    mutationFn: async (output: Omit<CompositeOutput, "id" | "created_at" | "updated_at" | "api_user_id">) => {
      if (!organizationId || !apiUserId) throw new Error("Missing organization context");
      const payload: DbCompositeOutputInsert = {
        ...output,
        organization_id: organizationId,
        api_user_id: apiUserId,
      };
      const { data, error } = await supabase
        .from("composite_product_outputs")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-outputs", easyquoteProductId, apiUserId] });
    },
  });

  // Update output mutation
  const updateOutputMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompositeOutput> & { id: string }) => {
      const { data, error } = await supabase
        .from("composite_product_outputs")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-outputs", easyquoteProductId, apiUserId] });
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
      queryClient.invalidateQueries({ queryKey: ["composite-outputs", easyquoteProductId, apiUserId] });
    },
  });

  // Add component mutation
  const addComponentMutation = useMutation({
    mutationFn: async (component: Omit<CompositeComponent, "id" | "created_at" | "updated_at" | "api_user_id">) => {
      if (!organizationId || !apiUserId) throw new Error("Missing organization context");
      const payload: DbCompositeComponentInsert = {
        ...component,
        organization_id: organizationId,
        api_user_id: apiUserId,
      };
      const { data, error } = await supabase
        .from("composite_product_components")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-components", easyquoteProductId, apiUserId] });
    },
  });

  // Update component mutation
  const updateComponentMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompositeComponent> & { id: string }) => {
      const { data, error } = await supabase
        .from("composite_product_components")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-components", easyquoteProductId, apiUserId] });
    },
  });

  // Delete component mutation
  const deleteComponentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("composite_product_components")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-components", easyquoteProductId, apiUserId] });
    },
  });

  // Upsert prompt connection mutation
  const upsertConnectionMutation = useMutation({
    mutationFn: async (connection: Omit<PromptConnection, "id" | "created_at" | "updated_at" | "api_user_id">) => {
      if (!organizationId || !apiUserId) throw new Error("Missing organization context");
      const payload: DbPromptConnectionInsert = {
        ...connection,
        organization_id: organizationId,
        api_user_id: apiUserId,
      };
      const { data, error } = await supabase
        .from("composite_prompt_connections")
        .upsert(payload, {
          onConflict: "api_user_id,composite_product_id,target_component_id,target_prompt_name",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompt-connections", easyquoteProductId, apiUserId] });
    },
  });

  // Delete prompt connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("composite_prompt_connections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompt-connections", easyquoteProductId, apiUserId] });
    },
  });

  // Delete connections by target component
  const deleteConnectionsByComponentMutation = useMutation({
    mutationFn: async (targetComponentId: string) => {
      const { error } = await supabase
        .from("composite_prompt_connections")
        .delete()
        .eq("composite_product_id", easyquoteProductId)
        .eq("target_component_id", targetComponentId)
        // Prefer deleting by api_user_id to remove shared config, fallback to org for legacy
        .eq("api_user_id", apiUserId as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-prompt-connections", easyquoteProductId, apiUserId] });
    },
  });

  // Upsert output aggregation mutation
  const upsertAggregationMutation = useMutation({
    mutationFn: async (aggregation: Omit<OutputAggregation, "id" | "created_at" | "updated_at" | "api_user_id">) => {
      if (!organizationId || !apiUserId) throw new Error("Missing organization context");
      const payload: DbOutputAggregationInsert = {
        ...aggregation,
        organization_id: organizationId,
        api_user_id: apiUserId,
      };
      const { data, error } = await supabase
        .from("composite_output_aggregations")
        .upsert(payload, {
          onConflict: "api_user_id,composite_product_id,source_output_name",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-output-aggregations", easyquoteProductId, apiUserId] });
    },
  });

  // Delete output aggregation mutation
  const deleteAggregationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("composite_output_aggregations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["composite-output-aggregations", easyquoteProductId, apiUserId] });
    },
  });

  return {
    // Data
    prompts,
    outputs,
    components,
    promptConnections,
    outputAggregations,
    availableComponentProducts,
    organizationId,
    apiUserId,

    // Loading states
    promptsLoading,
    outputsLoading,
    componentsLoading,
    connectionsLoading,
    aggregationsLoading,
    availableComponentsLoading,
    isLoading: promptsLoading || outputsLoading || componentsLoading || connectionsLoading || aggregationsLoading,

    // Refetch
    refetchPrompts,
    refetchOutputs,
    refetchComponents,
    refetchConnections,
    refetchAggregations,

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

    // Component mutations
    addComponent: addComponentMutation.mutateAsync,
    updateComponent: updateComponentMutation.mutateAsync,
    deleteComponent: deleteComponentMutation.mutateAsync,
    isAddingComponent: addComponentMutation.isPending,
    isUpdatingComponent: updateComponentMutation.isPending,
    isDeletingComponent: deleteComponentMutation.isPending,

    // Connection mutations
    upsertConnection: upsertConnectionMutation.mutateAsync,
    deleteConnection: deleteConnectionMutation.mutateAsync,
    deleteConnectionsByComponent: deleteConnectionsByComponentMutation.mutateAsync,
    isUpsertingConnection: upsertConnectionMutation.isPending,
    isDeletingConnection: deleteConnectionMutation.isPending,

    // Aggregation mutations
    upsertAggregation: upsertAggregationMutation.mutateAsync,
    deleteAggregation: deleteAggregationMutation.mutateAsync,
    isUpsertingAggregation: upsertAggregationMutation.isPending,
    isDeletingAggregation: deleteAggregationMutation.isPending,
  };
}
