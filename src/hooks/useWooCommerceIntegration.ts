import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const useWooCommerceIntegration = () => {
  const [isWooCommerceActive, setIsWooCommerceActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const { organization, membership } = useSubscription();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    checkWooCommerceIntegration();
  }, [currentOrganization?.id]);

  const checkWooCommerceIntegration = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      // First get the WooCommerce integration ID
      const { data: integrationData, error: integrationError } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'WooCommerce')
        .maybeSingle();

      if (integrationError || !integrationData) {
        setIsWooCommerceActive(false);
        setLoading(false);
        return;
      }

      // Then check if the organization has access to WooCommerce integration
      const { data: accessData, error: accessError } = await supabase
        .from('organization_integration_access')
        .select('id, is_active')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_id', integrationData.id)
        .maybeSingle();

      if (accessError && accessError.code !== 'PGRST116') {
        console.error('Error checking WooCommerce integration access:', accessError);
        setIsWooCommerceActive(false);
        setLoading(false);
        return;
      }

      // If no access record exists, integration is not available
      if (!accessData) {
        setIsWooCommerceActive(false);
        setLoading(false);
        return;
      }

      // Check if access is active
      setIsWooCommerceActive(accessData.is_active);
    } catch (error) {
      console.error('Error checking WooCommerce integration:', error);
      setIsWooCommerceActive(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    isWooCommerceActive,
    loading,
    refreshIntegration: checkWooCommerceIntegration
  };
};
