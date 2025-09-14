import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const useIntegrationAccess = () => {
  const [hasIntegrationAccess, setHasIntegrationAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const { organization, membership, isSuperAdmin } = useSubscription();

  useEffect(() => {
    checkIntegrationAccess();
  }, [organization, membership, isSuperAdmin]);

  const checkIntegrationAccess = async () => {
    try {
      // Superadmins always have access
      if (isSuperAdmin) {
        setHasIntegrationAccess(true);
        setLoading(false);
        return;
      }

      // Get the current user's organization ID
      const orgId = organization?.id || membership?.organization_id;
      
      if (!orgId) {
        setHasIntegrationAccess(false);
        setLoading(false);
        return;
      }

      // Check if the organization has any active integration access
      const { data, error } = await supabase
        .from('organization_integration_access')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error checking integration access:', error);
        setHasIntegrationAccess(false);
      } else {
        setHasIntegrationAccess(data && data.length > 0);
      }
    } catch (error) {
      console.error('Error in checkIntegrationAccess:', error);
      setHasIntegrationAccess(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    hasIntegrationAccess,
    loading,
    refreshIntegrationAccess: checkIntegrationAccess
  };
};