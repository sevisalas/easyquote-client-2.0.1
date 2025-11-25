import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductionPhase {
  id: string;
  name: string;
  display_name: string;
  display_order: number;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProductionPhases() {
  const { toast } = useToast();

  const { data: phases = [], isLoading, error } = useQuery({
    queryKey: ["production-phases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_phases")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) {
        console.error("Error fetching production phases:", error);
        throw error;
      }

      return data as ProductionPhase[];
    },
  });

  if (error) {
    toast({
      title: "Error",
      description: "No se pudieron cargar las fases de producción",
      variant: "destructive",
    });
  }

  return {
    phases,
    isLoading,
  };
}
