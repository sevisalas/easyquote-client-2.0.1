import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductPromptSetting {
  id: string;
  organization_id: string;
  easyquote_product_id: string;
  prompt_name: string;
  hide_in_documents: boolean;
  admin_only: boolean;
  force_result: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para obtener la configuración de visibilidad de prompts (admin_only, hide_in_documents)
 */
export function useProductPromptSettings(easyquoteProductId?: string) {
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

  // Obtener configuraciones de prompts para el producto
  const { data: promptSettings = [], isLoading } = useQuery({
    queryKey: ['product-prompt-settings', easyquoteProductId, organizationId],
    queryFn: async () => {
      if (!easyquoteProductId || !organizationId) return [];
      
      const { data, error } = await supabase
        .from('product_prompt_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('easyquote_product_id', easyquoteProductId);
      
      if (error) throw error;
      return data as ProductPromptSetting[];
    },
    enabled: !!easyquoteProductId && !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutos - la configuración de prompts cambia raramente
    refetchOnWindowFocus: false,
  });

  const normalizePromptName = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

  // Mapa para acceso rápido
  const settingsByPromptName = useMemo(() => {
    const map = new Map<string, ProductPromptSetting>();
    for (const s of promptSettings) {
      map.set(normalizePromptName(s.prompt_name), s);
    }
    return map;
  }, [promptSettings]);

  // Helper: verificar si un prompt es admin_only
  const isPromptAdminOnly = (promptName: string): boolean => {
    const setting = settingsByPromptName.get(normalizePromptName(promptName));
    return setting?.admin_only ?? false;
  };

  // Helper: verificar si un prompt está oculto en documentos
  const isPromptHiddenInDocuments = (promptName: string): boolean => {
    const setting = settingsByPromptName.get(normalizePromptName(promptName));
    return setting?.hide_in_documents ?? false;
  };

  // Helper: verificar si un prompt es "forzar resultado"
  const isPromptForceResult = (promptName: string): boolean => {
    const setting = settingsByPromptName.get(normalizePromptName(promptName));
    return setting?.force_result ?? false;
  };

  // Helper: obtener la configuración completa de un prompt
  const getPromptSetting = (promptName: string): ProductPromptSetting | undefined => {
    return settingsByPromptName.get(normalizePromptName(promptName));
  };

  return {
    promptSettings,
    isLoading,
    organizationId,
    isPromptAdminOnly,
    isPromptHiddenInDocuments,
    isPromptForceResult,
    getPromptSetting,
  };
}
