import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductOutputOtSetting {
  id: string;
  api_user_id: string;
  organization_id: string;
  easyquote_product_id: string;
  output_name: string;
  label: string | null;
  show_in_ot: boolean;
  ot_section: string | null;
  created_at: string;
  updated_at: string;
}

export const OT_SECTIONS = [
  { value: "datos_destacados", label: "Datos destacados" },
  { value: "impresion", label: "Impresión" },
  { value: "acabados", label: "Acabados" },
  { value: "imposiciones", label: "Imposiciones" },
  { value: "ajustes", label: "Ajustes" },
  { value: "observaciones", label: "Observaciones y notas" },
] as const;

export function useProductOutputOtSettings(easyquoteProductId?: string) {
  const queryClient = useQueryClient();

  // Resolve api_user_id (same pattern as useProductPromptSettings)
  const { data: orgData } = useQuery({
    queryKey: ["current-user-org-data", sessionStorage.getItem("selected_organization_id")],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

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

  const { data: outputSettings = [], isLoading, refetch } = useQuery({
    queryKey: ["product-output-ot-settings", easyquoteProductId, apiUserId],
    queryFn: async () => {
      if (!easyquoteProductId || !apiUserId) return [];

      const { data, error } = await supabase
        .from("product_output_ot_settings" as any)
        .select("*")
        .eq("api_user_id", apiUserId)
        .eq("easyquote_product_id", easyquoteProductId);

      if (error) throw error;
      return (data || []) as unknown as ProductOutputOtSetting[];
    },
    enabled: !!easyquoteProductId && !!apiUserId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const normalizeOutputName = (v: string) => String(v ?? "").trim().toUpperCase();

  const settingsByOutputName = useMemo(() => {
    const map = new Map<string, ProductOutputOtSetting>();
    for (const s of outputSettings) {
      map.set(normalizeOutputName(s.output_name), s);
      if (s.label) {
        map.set(normalizeOutputName(s.label), s);
      }
    }
    return map;
  }, [outputSettings]);

  const isOutputInOt = (outputName: string): boolean => {
    const setting = settingsByOutputName.get(normalizeOutputName(outputName));
    return setting?.show_in_ot ?? false;
  };

  const getOutputOtSection = (outputName: string): string | null => {
    const setting = settingsByOutputName.get(normalizeOutputName(outputName));
    return setting?.ot_section ?? null;
  };

  const getOutputSetting = (outputName: string): ProductOutputOtSetting | undefined => {
    return settingsByOutputName.get(normalizeOutputName(outputName));
  };

  const upsertMutation = useMutation({
    mutationFn: async (setting: {
      output_name: string;
      label?: string;
      show_in_ot: boolean;
      ot_section: string | null;
    }) => {
      if (!apiUserId || !organizationId || !easyquoteProductId) {
        throw new Error("Missing context");
      }

      const { data, error } = await supabase
        .from("product_output_ot_settings" as any)
        .upsert(
          {
            api_user_id: apiUserId,
            organization_id: organizationId,
            easyquote_product_id: easyquoteProductId,
            output_name: setting.output_name,
            label: setting.label || null,
            show_in_ot: setting.show_in_ot,
            ot_section: setting.ot_section,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "api_user_id,easyquote_product_id,output_name" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-output-ot-settings", easyquoteProductId, apiUserId],
      });
    },
  });

  return {
    outputSettings,
    isLoading,
    organizationId,
    apiUserId,
    isOutputInOt,
    getOutputOtSection,
    getOutputSetting,
    upsertOutputOtSetting: upsertMutation.mutateAsync,
    refetch,
  };
}
