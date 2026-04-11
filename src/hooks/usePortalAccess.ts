import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const usePortalAccess = () => {
  const queryClient = useQueryClient();
  const { organization, membership, isSuperAdmin } = useSubscription();
  const orgId = organization?.id || membership?.organization_id;

  const { data: hasPortalAccess = false, isLoading: loading } = useQuery({
    queryKey: ['portal-access', orgId],
    queryFn: async () => {
      if (!orgId) return false;

      const { data, error } = await supabase
        .from('organizations')
        .select('client_portal')
        .eq('id', orgId)
        .maybeSingle();

      if (error) {
        console.error('Error checking portal access:', error);
        return false;
      }

      return data?.client_portal === true;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refreshPortalAccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['portal-access', orgId] });
  }, [queryClient, orgId]);

  return { hasPortalAccess, loading, refreshPortalAccess };
};
