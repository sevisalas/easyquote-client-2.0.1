import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductPromptSetting {
  id: string;
  api_user_id: string;
  organization_id: string;
  easyquote_product_id: string;
  prompt_name: string;
  label?: string;
  hide_in_documents: boolean;
  admin_only: boolean;
  force_result: boolean;
  is_hidden: boolean;
  is_quantity: boolean;
  show_in_ot: boolean;
  ot_section: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para obtener la configuración de visibilidad de prompts (admin_only, hide_in_documents)
 * IMPORTANTE: Usa api_user_id como clave para compartir configuración entre organizaciones del mismo grupo
 */
export function useProductPromptSettings(easyquoteProductId?: string) {
  // Resolver organization_id + api_user_id de forma robusta.
  // Fuente de verdad: organización seleccionada (sessionStorage) → evita inconsistencias
  // entre Anebri/Campillo y también funciona en impersonación/superadmin.
  const { data: orgData } = useQuery({
    queryKey: ["current-user-org-data", sessionStorage.getItem("selected_organization_id")],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // 1) Preferir siempre la organización seleccionada en la app
      const selectedOrgId = sessionStorage.getItem("selected_organization_id");
      if (selectedOrgId) {
        const { data: selectedOrg, error } = await supabase
          .from("organizations")
          .select("id, api_user_id")
          .eq("id", selectedOrgId)
          .maybeSingle();
        if (!error && selectedOrg) {
          return { organization_id: selectedOrg.id, api_user_id: selectedOrg.api_user_id };
        }
      }

      // 2) Fallback: buscar como miembro (primer registro)
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id, organization:organizations(api_user_id)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.organization_id) {
        const org = membership.organization as any;
        return {
          organization_id: membership.organization_id,
          api_user_id: org?.api_user_id,
        };
      }

      return null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const apiUserId = orgData?.api_user_id;
  const organizationId = orgData?.organization_id;

  // Obtener configuraciones de prompts para el producto (por api_user_id)
  const { data: promptSettings = [], isLoading } = useQuery({
    queryKey: ['product-prompt-settings', easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];
      
      const { data, error } = await supabase
        .from('product_prompt_settings')
        .select('*')
        .eq('api_user_id', apiUserId)
        .eq('easyquote_product_id', easyquoteProductId);
      
      if (error) throw error;
      return data as ProductPromptSetting[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const normalizePromptName = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

  // Mapa para acceso rápido
  const settingsByPromptName = useMemo(() => {
    const map = new Map<string, ProductPromptSetting>();
    for (const s of promptSettings) {
      map.set(normalizePromptName(s.prompt_name), s);
      // Also index by label for UUID-based lookups
      if (s.label) {
        map.set(normalizePromptName(s.label), s);
      }
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

  // Helper: verificar si un prompt está oculto para el usuario
  const isPromptHidden = (promptName: string): boolean => {
    const setting = settingsByPromptName.get(normalizePromptName(promptName));
    return setting?.is_hidden ?? false;
  };

  // Helper: verificar si un prompt es el campo de cantidad
  const isPromptQuantity = (promptName: string): boolean => {
    const setting = settingsByPromptName.get(normalizePromptName(promptName));
    return setting?.is_quantity ?? false;
  };

  // Helper: obtener el prompt marcado como cantidad para el producto actual
  const getQuantityPromptName = (): string | undefined => {
    for (const s of promptSettings) {
      if (s.is_quantity) return s.prompt_name;
    }
    return undefined;
  };

  // Helper: verificar si un prompt aparece en la OT
  const isPromptInOt = (promptName: string): boolean => {
    const setting = settingsByPromptName.get(normalizePromptName(promptName));
    return setting?.show_in_ot ?? false;
  };

  // Helper: obtener la sección OT de un prompt
  const getPromptOtSection = (promptName: string): string | null => {
    const setting = settingsByPromptName.get(normalizePromptName(promptName));
    return setting?.ot_section ?? null;
  };

  // Helper: obtener la configuración completa de un prompt
  const getPromptSetting = (promptName: string): ProductPromptSetting | undefined => {
    return settingsByPromptName.get(normalizePromptName(promptName));
  };

  return {
    promptSettings,
    isLoading,
    organizationId,
    apiUserId,
    isPromptAdminOnly,
    isPromptHiddenInDocuments,
    isPromptForceResult,
    isPromptHidden,
    isPromptQuantity,
    isPromptInOt,
    getPromptOtSection,
    getQuantityPromptName,
    getPromptSetting,
  };
}
