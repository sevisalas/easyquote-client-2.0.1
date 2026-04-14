import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerDiscount {
  id: string;
  customer_id: string;
  organization_id: string;
  name: string;
  percentage: number;
  is_discount: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type CustomerDiscountInsert = Omit<CustomerDiscount, "id" | "created_at" | "updated_at">;

export function useCustomerDiscounts(customerId: string | null, organizationId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["customer_discounts", customerId, organizationId];

  const { data: discounts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!customerId || !organizationId) return [];
      const { data, error } = await supabase
        .from("customer_discounts" as any)
        .select("*")
        .eq("customer_id", customerId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as CustomerDiscount[];
    },
    enabled: !!customerId && !!organizationId,
  });

  const activeDiscounts = discounts.filter((d) => d.is_active);

  const createDiscount = useMutation({
    mutationFn: async (discount: Omit<CustomerDiscountInsert, "customer_id" | "organization_id">) => {
      if (!customerId || !organizationId) throw new Error("Missing customer or organization");
      const { error } = await supabase
        .from("customer_discounts" as any)
        .insert({ ...discount, customer_id: customerId, organization_id: organizationId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateDiscount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomerDiscount> & { id: string }) => {
      const { error } = await supabase
        .from("customer_discounts" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_discounts" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  /**
   * Calculate the combined discount multiplier for all active discounts.
   * Returns the total percentage adjustment (e.g., -10 for 10% discount).
   */
  const calculateDiscountAdjustment = (subtotal: number): number => {
    let adjustment = 0;
    activeDiscounts.forEach((d) => {
      const amount = (subtotal * d.percentage) / 100;
      adjustment += d.is_discount ? -amount : amount;
    });
    return adjustment;
  };

  return {
    discounts,
    activeDiscounts,
    isLoading,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    calculateDiscountAdjustment,
  };
}

/**
 * Lightweight hook to fetch the active tariff assigned to a customer for quote pages.
 * Keeps backward compatibility with legacy customer_discounts records.
 */
export function useActiveCustomerDiscounts(customerId: string | null, organizationId: string | null) {
  const normalizedCustomerId = customerId?.startsWith('holded:') ? customerId.replace('holded:', '') : customerId;
  const resolvedOrganizationId = organizationId || (typeof window !== "undefined" ? sessionStorage.getItem("selected_organization_id") : null);

  const {
    data: activeDiscounts = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["customer_discounts_active", normalizedCustomerId, resolvedOrganizationId],
    queryFn: async () => {
      if (!normalizedCustomerId || !resolvedOrganizationId) return [] as CustomerDiscount[];

      // 1. Get the customer's tariff_id
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("tariff_id")
        .eq("id", normalizedCustomerId)
        .maybeSingle();

      if (custErr || !customer?.tariff_id) return [] as CustomerDiscount[];

      // 2. Fetch the tariff if active
      const { data: tariff, error: tarErr } = await supabase
        .from("tariffs" as any)
        .select("*")
        .eq("id", customer.tariff_id)
        .eq("is_active", true)
        .maybeSingle();

      if (tarErr || !tariff) return [] as CustomerDiscount[];

      const t = tariff as any;
      return [{
        id: t.id,
        customer_id: normalizedCustomerId,
        organization_id: resolvedOrganizationId,
        name: t.name,
        percentage: t.percentage,
        is_discount: t.is_discount,
        is_active: true,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }] as CustomerDiscount[];
    },
    enabled: !!normalizedCustomerId && !!resolvedOrganizationId,
    refetchOnMount: "always",
  });

  const calculateDiscountAdjustment = (subtotal: number): number => {
    let adjustment = 0;
    activeDiscounts.forEach((d: CustomerDiscount) => {
      const amount = (subtotal * d.percentage) / 100;
      adjustment += d.is_discount ? -amount : amount;
    });
    return adjustment;
  };

  return { activeDiscounts, calculateDiscountAdjustment, isFetching, refetch };
}
