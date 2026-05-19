import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductionPhase {
  id: string;
  name: string;
  display_name: string;
  display_order: number;
  color: string;
  is_active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useProductionPhases() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = sessionStorage.getItem("selected_organization_id");

  const { data: phases = [], isLoading, error } = useQuery({
    queryKey: ["production-phases", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("production_phases")
        .select("*")
        .eq("is_active", true);

      if (organizationId) {
        query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      } else {
        query = query.is("organization_id", null);
      }

      const { data, error } = await query.order("display_order");

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

  const createPhase = useMutation({
    mutationFn: async (input: { display_name: string; color: string }) => {
      if (!organizationId) throw new Error("No organization selected");
      const name = input.display_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const maxOrder = Math.max(0, ...phases.map((p) => p.display_order));
      const { error } = await supabase.from("production_phases").insert({
        name: `${name}_${Date.now()}`,
        display_name: input.display_name,
        color: input.color,
        display_order: maxOrder + 1,
        organization_id: organizationId,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-phases"] });
      toast({ title: "Fase creada" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al crear", description: e.message, variant: "destructive" });
    },
  });

  const updatePhase = useMutation({
    mutationFn: async (input: { id: string; display_name?: string; color?: string }) => {
      const updates: Record<string, unknown> = {};
      if (input.display_name !== undefined) updates.display_name = input.display_name;
      if (input.color !== undefined) updates.color = input.color;
      const { error } = await supabase
        .from("production_phases")
        .update(updates)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-phases"] });
      toast({ title: "Fase actualizada" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" });
    },
  });

  const deletePhase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_phases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-phases"] });
      toast({ title: "Fase eliminada" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    },
  });

  return {
    phases,
    isLoading,
    organizationId,
    createPhase: createPhase.mutate,
    updatePhase: updatePhase.mutate,
    deletePhase: deletePhase.mutate,
  };
}
