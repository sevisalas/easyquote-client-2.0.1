import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export type HoldedExportMode = 'all' | 'orders_only';

export interface HoldedConfiguration {
  export_mode?: HoldedExportMode;
}

export const useHoldedIntegration = () => {
  const [hasHoldedAccess, setHasHoldedAccess] = useState(false);
  const [isHoldedActive, setIsHoldedActive] = useState(false);
  const [exportMode, setExportMode] = useState<HoldedExportMode>('all');
  const [loading, setLoading] = useState(true);
  const { organization, membership } = useSubscription();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    checkHoldedIntegration();
  }, [currentOrganization?.id]);

  const checkHoldedIntegration = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      // First get the Holded integration ID
      const { data: integrationData, error: integrationError } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'Holded')
        .maybeSingle();

      if (integrationError || !integrationData) {
        setHasHoldedAccess(false);
        setIsHoldedActive(false);
        setLoading(false);
        return;
      }

      // Then check if the organization has access to Holded integration
      const { data: accessData, error: accessError } = await supabase
        .from('organization_integration_access')
        .select('id, is_active, access_token_encrypted, configuration')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_id', integrationData.id)
        .maybeSingle();

      if (accessError && accessError.code !== 'PGRST116') {
        console.error('Error checking Holded integration access:', accessError);
        setHasHoldedAccess(false);
        setIsHoldedActive(false);
        setLoading(false);
        return;
      }

      // If no access record exists, organization doesn't have access
      if (!accessData) {
        setHasHoldedAccess(false);
        setIsHoldedActive(false);
        setLoading(false);
        return;
      }

      // Organization has access to Holded - but only active if token is configured
      setHasHoldedAccess(true);
      setIsHoldedActive(accessData.is_active && !!accessData.access_token_encrypted);
      
      // Parse configuration for export mode
      const config = accessData.configuration as HoldedConfiguration | null;
      setExportMode(config?.export_mode || 'all');
    } catch (error) {
      console.error('Error checking Holded integration:', error);
      setHasHoldedAccess(false);
      setIsHoldedActive(false);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if quotes can be exported
  const canExportQuotes = isHoldedActive && exportMode === 'all';
  
  // Helper to check if orders can be exported  
  const canExportOrders = isHoldedActive;

  return {
    hasHoldedAccess,
    isHoldedActive,
    exportMode,
    canExportQuotes,
    canExportOrders,
    loading,
    refreshIntegration: checkHoldedIntegration
  };
};
