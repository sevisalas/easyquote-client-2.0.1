import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const useWooCommerceIntegration = () => {
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  const { data: isWooCommerceActive = false, isLoading: loading, refetch } = useQuery({
    queryKey: ['woocommerce-integration', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        console.log("WooCommerce Integration: No organization ID");
        return false;
      }

      try {
        // First get the WooCommerce integration ID
        const { data: integrationData, error: integrationError } = await supabase
          .from('integrations')
          .select('id')
          .eq('name', 'WooCommerce')
          .maybeSingle();

        console.log("WooCommerce Integration Check:", { integrationData, integrationError });

        if (integrationError || !integrationData) {
          console.log("WooCommerce Integration: No integration found");
          return false;
        }

        // Then check if the organization has access to WooCommerce integration
        const { data: accessData, error: accessError } = await supabase
          .from('organization_integration_access')
          .select('id, is_active, configuration')
          .eq('organization_id', currentOrganization.id)
          .eq('integration_id', integrationData.id)
          .maybeSingle();

        console.log("WooCommerce Access Check:", { accessData, accessError });

        if (accessError && accessError.code !== 'PGRST116') {
          console.error('Error checking WooCommerce integration access:', accessError);
          return false;
        }

        // If no access record exists, integration is not available
        if (!accessData) {
          console.log("WooCommerce Integration: No access record");
          return false;
        }

        // Check if organization has an API key
        const { data: apiKeyData, error: apiKeyError } = await supabase
          .from('organization_api_credentials')
          .select('id')
          .eq('organization_id', currentOrganization.id)
          .eq('is_active', true)
          .limit(1)
          .single();

        console.log("WooCommerce API Key Check:", { apiKeyData, apiKeyError });

        if (apiKeyError && apiKeyError.code !== 'PGRST116') {
          console.error('Error checking API key:', apiKeyError);
        }

        // Integration is active only if access is active AND API key exists
        const isActive = accessData.is_active && !!apiKeyData;
        console.log("WooCommerce Integration Final Status:", { 
          accessIsActive: accessData.is_active, 
          hasApiKey: !!apiKeyData,
          finalStatus: isActive 
        });
        
        return isActive;
      } catch (error) {
        console.error('Error checking WooCommerce integration:', error);
        return false;
      }
    },
    enabled: !!currentOrganization?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    isWooCommerceActive,
    loading,
    refreshIntegration: refetch
  };
};
