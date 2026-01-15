import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductComponentSettings {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  is_composite: boolean;
  is_component: boolean;
  enabled_components: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductPromptComponent {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  prompt_name: string;
  component: string; // Ahora acepta cualquier componente, no solo los hardcodeados
  created_at: string;
  updated_at: string;
}

// Presets de componentes para diferentes tipos de productos
export const COMPONENT_PRESETS = {
  encuadernado: {
    label: 'Encuadernado',
    components: [
      { value: 'cubierta', label: 'Cubierta' },
      { value: 'interior_1', label: 'Interior 1' },
      { value: 'interior_2', label: 'Interior 2' },
    ],
    defaultEnabled: ['cubierta', 'interior_1'], // Interior 1 siempre, cubierta por defecto
  },
  // Futuros presets se pueden añadir aquí:
  // diptico: { label: 'Díptico', components: [...], defaultEnabled: [...] },
  // triptico: { label: 'Tríptico', components: [...], defaultEnabled: [...] },
} as const;

// Componente especial "general" que siempre existe
export const GENERAL_COMPONENT = { value: 'general', label: 'General' };

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
    staleTime: 5 * 60 * 1000, // 5 minutos - la configuración de componentes cambia raramente
    refetchOnWindowFocus: false,
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
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  });

  // Crear o actualizar configuración de componentes
  const upsertSettingsMutation = useMutation({
    mutationFn: async (settings: {
      easyquote_product_id: string;
      is_composite?: boolean;
      is_component?: boolean;
      enabled_components?: string[];
    }) => {
      if (!organizationId) throw new Error('No organization found');

      const payload: any = {
        organization_id: organizationId,
        easyquote_product_id: settings.easyquote_product_id,
        updated_at: new Date().toISOString(),
      };
      
      if (settings.is_composite !== undefined) payload.is_composite = settings.is_composite;
      if (settings.is_component !== undefined) payload.is_component = settings.is_component;
      if (settings.enabled_components !== undefined) payload.enabled_components = settings.enabled_components;

      const { data, error } = await supabase
        .from('product_component_settings')
        .upsert(payload, {
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
      queryClient.invalidateQueries({
        queryKey: ['component-product-ids'],
      });
    },
  });

  // Asignar prompt a componente
  const assignPromptToComponentMutation = useMutation({
    mutationFn: async (assignment: {
      easyquote_product_id: string;
      prompt_name: string;
      component: string; // Acepta cualquier nombre de componente
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

  // Helper: verificar si un producto es componente
  const isComponent = componentSettings?.is_component ?? false;

  // Helper: obtener componentes habilitados
  const enabledComponents = componentSettings?.enabled_components ?? [];

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
