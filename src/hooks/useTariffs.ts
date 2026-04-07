import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Tariff {
  id: string;
  organization_id: string;
  name: string;
  percentage: number;
  is_discount: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useTariffs(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["tariffs", organizationId];

  const { data: tariffs = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("tariffs" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Tariff[];
    },
    enabled: !!organizationId,
  });

  const createTariff = useMutation({
    mutationFn: async (tariff: Pick<Tariff, "name" | "percentage" | "is_discount">) => {
      if (!organizationId) throw new Error("No organization");
      const { error } = await supabase
        .from("tariffs" as any)
        .insert({ ...tariff, organization_id: organizationId, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateTariff = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tariff> & { id: string }) => {
      const { error } = await supabase
        .from("tariffs" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteTariff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tariffs" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { tariffs, isLoading, createTariff, updateTariff, deleteTariff };
}
