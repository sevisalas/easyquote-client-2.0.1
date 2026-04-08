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
  const { data: activeDiscounts = [] } = useQuery({
    queryKey: ["customer_discounts_active", customerId, organizationId],
    queryFn: async () => {
      if (!customerId || !organizationId) return [];

      const { data: customerData, error: customerError } = await supabase
        .from("customers" as any)
        .select("tariff_id")
        .eq("id", customerId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      const customerRecord = customerData as unknown as { tariff_id?: string | null } | null;
      const assignedTariffId = customerRecord?.tariff_id ?? null;

      let assignedTariff: {
        id: string;
        name: string;
        percentage: number;
        is_discount: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        organization_id: string;
      } | null = null;

      if (!customerError && assignedTariffId) {
        const { data: tariffData, error: tariffError } = await supabase
          .from("tariffs" as any)
          .select("id, name, percentage, is_discount, is_active, created_at, updated_at, organization_id")
          .eq("id", assignedTariffId)
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (!tariffError && tariffData) {
          assignedTariff = tariffData as unknown as {
            id: string;
            name: string;
            percentage: number;
            is_discount: boolean;
            is_active: boolean;
            created_at: string;
            updated_at: string;
            organization_id: string;
          };
        }
      }

      if (!customerError && assignedTariff?.is_active) {
        return [
          {
            id: assignedTariff.id,
            customer_id: customerId,
            organization_id: assignedTariff.organization_id ?? organizationId,
            name: assignedTariff.name,
            percentage: assignedTariff.percentage,
            is_discount: assignedTariff.is_discount,
            is_active: true,
            created_at: assignedTariff.created_at ?? new Date().toISOString(),
            updated_at: assignedTariff.updated_at ?? new Date().toISOString(),
          },
        ] as CustomerDiscount[];
      }

      if (customerError) {
        console.log("[CustomerDiscounts] No access to assigned tariff, checking legacy discounts");
      }

      const { data, error } = await supabase
        .from("customer_discounts" as any)
        .select("*")
        .eq("customer_id", customerId)
        .eq("organization_id", organizationId)
        .eq("is_active", true);

      if (error) {
        // RLS may block legacy discounts for non-admins; silently return empty
        console.log("[CustomerDiscounts] No access or no discounts");
        return [];
      }
      return (data || []) as unknown as CustomerDiscount[];
    },
    enabled: !!customerId && !!organizationId,
  });

  const calculateDiscountAdjustment = (subtotal: number): number => {
    let adjustment = 0;
    activeDiscounts.forEach((d: CustomerDiscount) => {
      const amount = (subtotal * d.percentage) / 100;
      adjustment += d.is_discount ? -amount : amount;
    });
    return adjustment;
  };

  return { activeDiscounts, calculateDiscountAdjustment };
}
