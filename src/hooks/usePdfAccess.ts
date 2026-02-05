import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const usePdfAccess = () => {
  const queryClient = useQueryClient();
  const { organization, membership, isSuperAdmin } = useSubscription();
  const orgId = organization?.id || membership?.organization_id;

  // Solo los propietarios de organizaciones y admins tienen acceso a plantillas PDF
  const isOrgOwner = organization !== null;
  const isOrgAdmin = membership?.role === 'admin';
  const hasRole = isSuperAdmin || isOrgOwner || isOrgAdmin;

  const { data: hasPdfAccess = false, isLoading: loading } = useQuery({
    queryKey: ['pdf-access', orgId, isSuperAdmin],
    queryFn: async () => {
      // Superadmins always have access
      if (isSuperAdmin) {
        return true;
      }

      // Los usuarios normales (organization_members sin rol admin) NO tienen acceso
      if (!hasRole) {
        return false;
      }

      if (!orgId) {
        return false;
      }

      // Check if the organization has an active integration
      const { data, error } = await supabase
        .from('organization_integration_access')
        .select('generate_pdfs, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking PDF access:', error);
        return false; // Default to false on errors for security
      }
      
      if (!data) {
        // If no integration exists, allow PDF access for admins by default
        return true;
      }
      
      // If integration exists and is active, check generate_pdfs flag
      return data?.generate_pdfs === true;
    },
    enabled: hasRole && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  });

  const refreshPdfAccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pdf-access', orgId, isSuperAdmin] });
  }, [queryClient, orgId, isSuperAdmin]);

  return {
    hasPdfAccess,
    loading,
    refreshPdfAccess
  };
};
