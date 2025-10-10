import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";


export const useHoldedIntegration = () => {
  const [isHoldedActive, setIsHoldedActive] = useState(false);
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
        setIsHoldedActive(false);
        setLoading(false);
        return;
      }

      // Then check if the organization has access to Holded integration
      const { data: accessData, error: accessError } = await supabase
        .from('organization_integration_access')
        .select('id, is_active')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_id', integrationData.id)
        .maybeSingle();

      if (accessError && accessError.code !== 'PGRST116') {
        console.error('Error checking Holded integration access:', accessError);
        setIsHoldedActive(false);
        setLoading(false);
        return;
      }

      // If no access record exists, integration is not available
      if (!accessData) {
        setIsHoldedActive(false);
        setLoading(false);
        return;
      }

      // Check if access is active
      setIsHoldedActive(accessData.is_active);
    } catch (error) {
      console.error('Error checking Holded integration:', error);
      setIsHoldedActive(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    isHoldedActive,
    loading,
    refreshIntegration: checkHoldedIntegration
  };
};