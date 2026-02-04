import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductComponentSettings {
  id: string;
  organization_id: string;
  api_user_id: string;
  easyquote_product_id: string;
  is_composite: boolean;
  is_component: boolean;
  enabled_components: string[];
  product_type: 'sencillo' | 'compuesto' | 'kit';
  created_at: string;
  updated_at: string;
}

export interface ProductPromptComponent {
  id: string;
  organization_id: string;
  api_user_id: string;
  easyquote_product_id: string;
  prompt_name: string;
  component: string;
  created_at: string;
  updated_at: string;
}

// Presets de componentes para diferentes tipos de productos
export const COMPONENT_PRESETS = {
  compuesto: {
    label: 'Compuesto',
    components: [
      { value: 'cubierta', label: 'Cubierta' },
      { value: 'interior_1', label: 'Interior 1' },
      { value: 'interior_2', label: 'Interior 2' },
    ],
    defaultEnabled: [],
  },
  kit: {
    label: 'Kit',
    components: [],
    defaultEnabled: [],
  },
} as const;

// Componente especial "general" que siempre existe
export const GENERAL_COMPONENT = { value: 'general', label: 'General' };

/**
 * Hook para gestionar la configuración de componentes de productos.
 * IMPORTANTE: La configuración se comparte entre organizaciones que tienen el mismo api_user_id.
 * Esto permite que empresas como Campillo/Anebri/Formación compartan la configuración de productos.
 */
export function useProductComponentSettings(
  easyquoteProductId?: string,
  apiUserIdOverride?: string
) {
  const queryClient = useQueryClient();

  // Obtener api_user_id de la organización del usuario actual
  const { data: orgData } = useQuery({
    queryKey: ['current-user-api-user-id'],
    queryFn: async () => {
      // Primero intentar obtener de la organización donde el usuario es dueño
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check if user is an org owner
      const { data: ownedOrg } = await supabase
        .from('organizations')
        .select('id, api_user_id')
        .eq('api_user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (ownedOrg) {
        return { organizationId: ownedOrg.id, apiUserId: ownedOrg.api_user_id };
      }

      // Otherwise get from membership
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, organization:organizations(id, api_user_id)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.organization) {
        const org = membership.organization as { id: string; api_user_id: string };
        return { organizationId: org.id, apiUserId: org.api_user_id };
      }

      return null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !apiUserIdOverride,
  });

  // Usar el override si está disponible, sino usar el del usuario
  const apiUserId = apiUserIdOverride || orgData?.apiUserId;
  const organizationId = orgData?.organizationId;

  // Obtener configuración de componentes para un producto específico (por api_user_id)
  const { data: componentSettings, isLoading, error } = useQuery({
    queryKey: ['product-component-settings', easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return null;
      
      const { data, error } = await supabase
        .from('product_component_settings')
        .select('*')
        .eq('api_user_id', apiUserId)
        .eq('easyquote_product_id', easyquoteProductId)
        .maybeSingle();
      
      if (error) throw error;
      return data as ProductComponentSettings | null;
    },
    enabled: !!easyquoteProductId && !!apiUserId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Obtener asignaciones de prompts a componentes (por api_user_id)
  const { data: promptComponents } = useQuery({
    queryKey: ['product-prompt-components', easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];
      
      const { data, error } = await supabase
        .from('product_prompt_components')
        .select('*')
        .eq('api_user_id', apiUserId)
        .eq('easyquote_product_id', easyquoteProductId);
      
      if (error) throw error;
      return data as ProductPromptComponent[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Crear o actualizar configuración de componentes (por api_user_id)
  const upsertSettingsMutation = useMutation({
    mutationFn: async (settings: {
      easyquote_product_id: string;
      is_composite?: boolean;
      is_component?: boolean;
      enabled_components?: string[];
      product_type?: 'sencillo' | 'compuesto' | 'kit';
    }) => {
      if (!apiUserId) throw new Error('No api_user_id found');
      if (!organizationId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('product_component_settings')
        .upsert({
          organization_id: organizationId,
          api_user_id: apiUserId,
          easyquote_product_id: settings.easyquote_product_id,
          is_composite: settings.is_composite,
          is_component: settings.is_component,
          enabled_components: settings.enabled_components,
          product_type: settings.product_type,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'api_user_id,easyquote_product_id',
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
      queryClient.invalidateQueries({
        queryKey: ['component-product-ids'],
      });
    },
  });

  // Asignar prompt a componente (por api_user_id)
  const assignPromptToComponentMutation = useMutation({
    mutationFn: async (assignment: {
      easyquote_product_id: string;
      prompt_name: string;
      component: string;
    }) => {
      if (!apiUserId) throw new Error('No api_user_id found');
      if (!organizationId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('product_prompt_components')
        .upsert({
          organization_id: organizationId,
          api_user_id: apiUserId,
          easyquote_product_id: assignment.easyquote_product_id,
          prompt_name: assignment.prompt_name,
          component: assignment.component,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'api_user_id,easyquote_product_id,prompt_name',
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

  // Eliminar asignación de prompt (por api_user_id)
  const removePromptComponentMutation = useMutation({
    mutationFn: async (params: {
      easyquote_product_id: string;
      prompt_name: string;
    }) => {
      if (!apiUserId) throw new Error('No api_user_id found');

      const { error } = await supabase
        .from('product_prompt_components')
        .delete()
        .eq('api_user_id', apiUserId)
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

  // Helper: verificar si un producto es componente
  const isComponent = componentSettings?.is_component ?? false;

  // Helper: obtener componentes habilitados
  const enabledComponents = componentSettings?.enabled_components ?? [];

  // Helper: obtener tipo de producto
  const productType = componentSettings?.product_type ?? 'sencillo';

  const normalizePromptName = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

  const componentByPromptName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of promptComponents ?? []) {
      map.set(normalizePromptName(p.prompt_name), p.component);
    }
    return map;
  }, [promptComponents]);

  // Helper: obtener el componente asignado a un prompt
  const getPromptComponent = (promptName: string): string => {
    return componentByPromptName.get(normalizePromptName(promptName)) ?? "general";
  };

  return {
    // Data
    componentSettings,
    promptComponents,
    isComposite,
    isComponent,
    enabledComponents,
    productType,
    apiUserId,
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
