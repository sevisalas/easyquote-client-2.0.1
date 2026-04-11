import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const usePdfAccess = () => {
  const queryClient = useQueryClient();
  const { organization, membership, isSuperAdmin } = useSubscription();
  const orgId = organization?.id || membership?.organization_id;

  const isOrgOwner = organization !== null;
  const isOrgAdmin = membership?.role === 'admin';
  const hasRole = isSuperAdmin || isOrgOwner || isOrgAdmin;

  const { data: hasPdfAccess = false, isLoading: loading } = useQuery({
    queryKey: ['pdf-access', orgId, isSuperAdmin],
    queryFn: async () => {
      if (isSuperAdmin) return true;
      if (!hasRole || !orgId) return false;

      const { data, error } = await supabase
        .from('organizations')
        .select('generate_pdfs')
        .eq('id', orgId)
        .maybeSingle();

      if (error) {
        console.error('Error checking PDF access:', error);
        return false;
      }

      return data?.generate_pdfs === true;
    },
    enabled: hasRole && !!orgId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refreshPdfAccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pdf-access', orgId, isSuperAdmin] });
  }, [queryClient, orgId, isSuperAdmin]);

  return { hasPdfAccess, loading, refreshPdfAccess };
};
