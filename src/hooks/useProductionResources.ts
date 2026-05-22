import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ProductionResourceType = "machine" | "manual";

export interface ProductionResource {
  id: string;
  organization_id: string;
  name: string;
  resource_type: ProductionResourceType;
  phase_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useProductionResources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = sessionStorage.getItem("selected_organization_id");

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["production-resources", organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as ProductionResource[];
      const { data, error } = await supabase
        .from("production_resources")
        .select("*")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as ProductionResource[];
    },
  });

  const createResource = useMutation({
    mutationFn: async (input: { name: string; resource_type: ProductionResourceType; phase_id: string | null }) => {
      if (!organizationId) throw new Error("No organization selected");
      const maxOrder = Math.max(0, ...resources.map((r) => r.sort_order));
      const { error } = await supabase.from("production_resources").insert({
        name: input.name,
        resource_type: input.resource_type,
        phase_id: input.phase_id,
        organization_id: organizationId,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-resources", organizationId] });
      toast({ title: "Recurso creado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al crear", description: e.message, variant: "destructive" });
    },
  });

  const updateResource = useMutation({
    mutationFn: async (input: { id: string; name?: string; resource_type?: ProductionResourceType; phase_id?: string | null }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.resource_type !== undefined) updates.resource_type = input.resource_type;
      if (input.phase_id !== undefined) updates.phase_id = input.phase_id;
      const { error } = await supabase
        .from("production_resources")
        .update(updates)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-resources", organizationId] });
      toast({ title: "Recurso actualizado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" });
    },
  });

  const deleteResource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-resources", organizationId] });
      toast({ title: "Recurso eliminado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    },
  });

  return {
    resources,
    isLoading,
    createResource: createResource.mutate,
    updateResource: updateResource.mutate,
    deleteResource: deleteResource.mutate,
  };
}