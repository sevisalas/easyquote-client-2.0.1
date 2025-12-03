import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const useWooCommerceIntegration = () => {
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['woocommerce-integration', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        console.log("WooCommerce Integration: No organization ID");
        return { hasAccess: false, isActive: false };
      }

      try {
        // First get the WooCommerce integration ID
        const { data: integrationData, error: integrationError } = await supabase
          .from('integrations')
          .select('id')
          .eq('name', 'WooCommerce')
          .maybeSingle();

        if (integrationError || !integrationData) {
          console.log("WooCommerce Integration: No integration found");
          return { hasAccess: false, isActive: false };
        }

        // Then check if the organization has access to WooCommerce integration
        const { data: accessData, error: accessError } = await supabase
          .from('organization_integration_access')
          .select('id, is_active, configuration')
          .eq('organization_id', currentOrganization.id)
          .eq('integration_id', integrationData.id)
          .maybeSingle();

        if (accessError && accessError.code !== 'PGRST116') {
          console.error('Error checking WooCommerce integration access:', accessError);
          return { hasAccess: false, isActive: false };
        }

        // If no access record exists, organization doesn't have access to this integration
        if (!accessData) {
          console.log("WooCommerce Integration: No access record");
          return { hasAccess: false, isActive: false };
        }

        // Organization has access, now check if it's fully configured
        const { data: apiKeyData, error: apiKeyError } = await supabase
          .from('organization_api_credentials')
          .select('id')
          .eq('organization_id', currentOrganization.id)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (apiKeyError && apiKeyError.code !== 'PGRST116') {
          console.error('Error checking API key:', apiKeyError);
        }

        // hasAccess = has record in organization_integration_access
        // isActive = hasAccess AND is_active AND has API key
        const isActive = accessData.is_active && !!apiKeyData;
        
        return { hasAccess: true, isActive };
      } catch (error) {
        console.error('Error checking WooCommerce integration:', error);
        return { hasAccess: false, isActive: false };
      }
    },
    enabled: !!currentOrganization?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    hasWooCommerceAccess: data?.hasAccess ?? false,
    isWooCommerceActive: data?.isActive ?? false,
    loading,
    refreshIntegration: refetch
  };
};
