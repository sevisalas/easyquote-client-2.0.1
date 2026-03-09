import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEasyQuoteToken } from "@/lib/easyquoteApi";

export interface OutputTypeVisibility {
  id: string;
  organization_id: string;
  output_type: string;
  show_in_admin: boolean;
  show_in_production: boolean;
  created_at: string;
  updated_at: string;
}

export interface EasyQuoteOutputType {
  id: number;
  outputType: string;
}

export function useOutputTypeVisibility() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = sessionStorage.getItem("selected_organization_id");

  // Fetch real output types from EasyQuote API
  const tokenReady = !!sessionStorage.getItem("easyquote_token");

  const { data: apiOutputTypes = [], isLoading: isLoadingTypes } = useQuery({
    queryKey: ["easyquote-output-types"],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const resp = await fetch("https://api.easyquote.cloud/api/v1/products/outputs/types", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      console.log("[OutputTypeVisibility] API output types:", data);
      return (Array.isArray(data) ? data : []) as EasyQuoteOutputType[];
    },
    enabled: tokenReady,
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

  const { data: visibilitySettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["output-type-visibility", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("output_type_visibility")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;
      return data as OutputTypeVisibility[];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });

  // Merge DB settings with API types — default both to true if no DB entry
  const mergedSettings = apiOutputTypes.map((t) => {
    const saved = visibilitySettings?.find((s) => s.output_type === t.outputType);
    return {
      output_type: t.outputType,
      label: t.outputType,
      api_id: t.id,
      show_in_admin: saved ? saved.show_in_admin : true,
      show_in_production: saved ? saved.show_in_production : true,
      id: saved?.id,
    };
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      output_type,
      field,
      value,
    }: {
      output_type: string;
      field: "show_in_admin" | "show_in_production";
      value: boolean;
    }) => {
      if (!organizationId) throw new Error("No organization found");

      const current = mergedSettings.find((s) => s.output_type === output_type);
      const row = {
        organization_id: organizationId,
        output_type,
        show_in_admin: current?.show_in_admin ?? true,
        show_in_production: current?.show_in_production ?? true,
        [field]: value,
      };

      const { error } = await supabase
        .from("output_type_visibility")
        .upsert(row, { onConflict: "organization_id,output_type" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["output-type-visibility"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar visibilidad",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper: check if a given output type is visible in a context
  const isVisibleIn = (outputType: string, context: "admin" | "production"): boolean => {
    const setting = mergedSettings.find((s) => s.output_type === outputType);
    if (!setting) return true; // unknown types visible by default
    return context === "admin" ? setting.show_in_admin : setting.show_in_production;
  };

  return {
    settings: mergedSettings,
    isLoading: isLoadingTypes || isLoadingSettings,
    toggleVisibility: toggleMutation.mutate,
    isVisibleIn,
  };
}
