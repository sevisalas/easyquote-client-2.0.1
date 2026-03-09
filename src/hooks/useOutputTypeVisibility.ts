import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface OutputTypeVisibility {
  id: string;
  organization_id: string;
  output_type: string;
  show_in_admin: boolean;
  show_in_production: boolean;
  created_at: string;
  updated_at: string;
}

// All known EasyQuote output types with sensible defaults
export const DEFAULT_OUTPUT_TYPES: Array<{
  output_type: string;
  label: string;
  show_in_admin: boolean;
  show_in_production: boolean;
}> = [
  { output_type: "Price", label: "Precio", show_in_admin: true, show_in_production: false },
  { output_type: "BestOption", label: "Mejor opción", show_in_admin: true, show_in_production: false },
  { output_type: "RunCost", label: "Coste tirada", show_in_admin: true, show_in_production: false },
  { output_type: "UnitCost", label: "Coste unitario", show_in_admin: true, show_in_production: false },
  { output_type: "Quantity", label: "Cantidad", show_in_admin: true, show_in_production: true },
  { output_type: "Instructions", label: "Instrucciones", show_in_admin: true, show_in_production: true },
  { output_type: "Workflow", label: "Flujo de trabajo", show_in_admin: true, show_in_production: true },
  { output_type: "Width", label: "Ancho", show_in_admin: false, show_in_production: true },
  { output_type: "Height", label: "Alto", show_in_admin: false, show_in_production: true },
  { output_type: "Depth", label: "Profundidad", show_in_admin: false, show_in_production: true },
  { output_type: "Weight", label: "Peso", show_in_admin: true, show_in_production: true },
  { output_type: "TotalSheets", label: "Total hojas", show_in_admin: true, show_in_production: true },
  { output_type: "ProductImage", label: "Imagen producto", show_in_admin: true, show_in_production: true },
  { output_type: "Generic", label: "Genérico", show_in_admin: true, show_in_production: true },
];

export function useOutputTypeVisibility() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization } = useSubscription();

  const { data: visibilitySettings, isLoading } = useQuery({
    queryKey: ["output-type-visibility", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from("output_type_visibility")
        .select("*")
        .eq("organization_id", organization.id);

      if (error) throw error;
      return data as OutputTypeVisibility[];
    },
    enabled: !!organization?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Merge DB settings with defaults — any type not in DB uses its default
  const mergedSettings = DEFAULT_OUTPUT_TYPES.map((def) => {
    const saved = visibilitySettings?.find((s) => s.output_type === def.output_type);
    return {
      output_type: def.output_type,
      label: def.label,
      show_in_admin: saved ? saved.show_in_admin : def.show_in_admin,
      show_in_production: saved ? saved.show_in_production : def.show_in_production,
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
      if (!organization?.id) throw new Error("No organization found");

      const { error } = await supabase
        .from("output_type_visibility")
        .upsert(
          {
            organization_id: organization.id,
            output_type,
            [field]: value,
          },
          { onConflict: "organization_id,output_type" }
        );

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
    isLoading,
    toggleVisibility: toggleMutation.mutate,
    isVisibleIn,
  };
}
