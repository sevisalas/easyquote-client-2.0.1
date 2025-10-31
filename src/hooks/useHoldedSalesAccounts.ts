import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useHoldedSalesAccounts = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ['holded-sales-accounts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('holded_sales_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
};
