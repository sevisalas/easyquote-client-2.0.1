import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export type HoldedExportMode = 'all' | 'orders_only';

export interface HoldedConfiguration {
  export_mode?: HoldedExportMode;
}

interface HoldedAccessData {
  hasAccess: boolean;
  isActive: boolean;
  exportMode: HoldedExportMode;
}

export const useHoldedIntegration = () => {
  const queryClient = useQueryClient();
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;
  const orgId = currentOrganization?.id;

  const { data, isLoading: loading } = useQuery<HoldedAccessData>({
    queryKey: ['holded-integration', orgId],
    queryFn: async () => {
      if (!orgId) {
        return { hasAccess: false, isActive: false, exportMode: 'all' as const };
      }

      // First get the Holded integration ID
      const { data: integrationData, error: integrationError } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'Holded')
        .maybeSingle();

      if (integrationError || !integrationData) {
        return { hasAccess: false, isActive: false, exportMode: 'all' as const };
      }

      // Then check if the organization has access to Holded integration
      const { data: accessData, error: accessError } = await supabase
        .from('organization_integration_access')
        .select('id, is_active, access_token_encrypted, configuration')
        .eq('organization_id', orgId)
        .eq('integration_id', integrationData.id)
        .maybeSingle();

      if (accessError && accessError.code !== 'PGRST116') {
        console.error('Error checking Holded integration access:', accessError);
        return { hasAccess: false, isActive: false, exportMode: 'all' as const };
      }

      // If no access record exists, organization doesn't have access
      if (!accessData) {
        return { hasAccess: false, isActive: false, exportMode: 'all' as const };
      }

      // Organization has access to Holded - but only active if token is configured
      const config = accessData.configuration as HoldedConfiguration | null;
      return {
        hasAccess: true,
        isActive: accessData.is_active && !!accessData.access_token_encrypted,
        exportMode: config?.export_mode || 'all',
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  });

  const hasHoldedAccess = data?.hasAccess ?? false;
  const isHoldedActive = data?.isActive ?? false;
  const exportMode = data?.exportMode ?? 'all';

  // Helper to check if quotes can be exported
  const canExportQuotes = useMemo(
    () => isHoldedActive && exportMode === 'all',
    [isHoldedActive, exportMode]
  );
  
  // Helper to check if orders can be exported  
  const canExportOrders = isHoldedActive;

  const refreshIntegration = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['holded-integration', orgId] });
  }, [queryClient, orgId]);

  return {
    hasHoldedAccess,
    isHoldedActive,
    exportMode,
    canExportQuotes,
    canExportOrders,
    loading,
    refreshIntegration
  };
};
