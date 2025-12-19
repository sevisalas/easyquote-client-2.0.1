import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductComponentSettings {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  is_composite: boolean;
  enabled_components: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductPromptComponent {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  prompt_name: string;
  component: 'general' | 'cubierta' | 'interior_1' | 'interior_2';
  created_at: string;
  updated_at: string;
}

export const COMPONENT_OPTIONS = [
  { value: 'cubierta', label: 'Cubierta' },
  { value: 'interior_1', label: 'Interior 1' },
  { value: 'interior_2', label: 'Interior 2' },
] as const;

export function useProductComponentSettings(easyquoteProductId?: string) {
  const queryClient = useQueryClient();

  // Obtener organization_id del usuario actual
  const { data: userRole } = useQuery({
    queryKey: ['current-user-role'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_current_user_role');
      if (error) throw error;
      return data?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const organizationId = userRole?.organization_id;

  // Obtener configuración de componentes para un producto específico
  const { data: componentSettings, isLoading, error } = useQuery({
    queryKey: ['product-component-settings', easyquoteProductId, organizationId],
    queryFn: async () => {
      if (!easyquoteProductId || !organizationId) return null;
      
      const { data, error } = await supabase
        .from('product_component_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('easyquote_product_id', easyquoteProductId)
        .maybeSingle();
      
      if (error) throw error;
      return data as ProductComponentSettings | null;
    },
    enabled: !!easyquoteProductId && !!organizationId,
  });

  // Obtener asignaciones de prompts a componentes
  const { data: promptComponents } = useQuery({
    queryKey: ['product-prompt-components', easyquoteProductId, organizationId],
    queryFn: async () => {
      if (!easyquoteProductId || !organizationId) return [];
      
      const { data, error } = await supabase
        .from('product_prompt_components')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('easyquote_product_id', easyquoteProductId);
      
      if (error) throw error;
      return data as ProductPromptComponent[];
    },
    enabled: !!easyquoteProductId && !!organizationId,
  });

  // Crear o actualizar configuración de componentes
  const upsertSettingsMutation = useMutation({
    mutationFn: async (settings: {
      easyquote_product_id: string;
      is_composite: boolean;
      enabled_components: string[];
    }) => {
      if (!organizationId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('product_component_settings')
        .upsert({
          organization_id: organizationId,
          easyquote_product_id: settings.easyquote_product_id,
          is_composite: settings.is_composite,
          enabled_components: settings.enabled_components,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,easyquote_product_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['product-component-settings', variables.easyquote_product_id],
      });
    },
  });

  // Asignar prompt a componente
  const assignPromptToComponentMutation = useMutation({
    mutationFn: async (assignment: {
      easyquote_product_id: string;
      prompt_name: string;
      component: 'general' | 'cubierta' | 'interior_1' | 'interior_2';
    }) => {
      if (!organizationId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('product_prompt_components')
        .upsert({
          organization_id: organizationId,
          easyquote_product_id: assignment.easyquote_product_id,
          prompt_name: assignment.prompt_name,
          component: assignment.component,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,easyquote_product_id,prompt_name',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['product-prompt-components', variables.easyquote_product_id],
      });
    },
  });

  // Eliminar asignación de prompt
  const removePromptComponentMutation = useMutation({
    mutationFn: async (params: {
      easyquote_product_id: string;
      prompt_name: string;
    }) => {
      if (!organizationId) throw new Error('No organization found');

      const { error } = await supabase
        .from('product_prompt_components')
        .delete()
        .eq('organization_id', organizationId)
        .eq('easyquote_product_id', params.easyquote_product_id)
        .eq('prompt_name', params.prompt_name);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['product-prompt-components', variables.easyquote_product_id],
      });
    },
  });

  // Helper: verificar si un producto es compuesto
  const isComposite = componentSettings?.is_composite ?? false;

  // Helper: obtener componentes habilitados
  const enabledComponents = componentSettings?.enabled_components ?? [];

  // Helper: obtener el componente asignado a un prompt
  const getPromptComponent = (promptName: string): 'general' | 'cubierta' | 'interior_1' | 'interior_2' => {
    const assignment = promptComponents?.find(p => p.prompt_name === promptName);
    return assignment?.component ?? 'general';
  };

  return {
    // Data
    componentSettings,
    promptComponents,
    isComposite,
    enabledComponents,
    organizationId,
    
    // Loading states
    isLoading,
    error,
    
    // Mutations
    upsertSettings: upsertSettingsMutation.mutateAsync,
    assignPromptToComponent: assignPromptToComponentMutation.mutateAsync,
    removePromptComponent: removePromptComponentMutation.mutateAsync,
    
    // Mutation states
    isUpserting: upsertSettingsMutation.isPending,
    isAssigning: assignPromptToComponentMutation.isPending,
    
    // Helpers
    getPromptComponent,
  };
}
