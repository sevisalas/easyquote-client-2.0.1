import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  calculator_id: string;
  calculator_disabled: boolean;
}

interface WooLinkStatus {
  isLinked: boolean;
  wooProducts: WooProduct[];
  count: number;
}

export const useWooCommerceLink = (productIds: string[]) => {
  return useQuery({
    queryKey: ['woocommerce-links', productIds],
    queryFn: async () => {
      if (!productIds || productIds.length === 0) {
        return {};
      }

      // Get WooCommerce configuration
      const { data: integrationData } = await supabase
        .from("integrations")
        .select("id")
        .eq("name", "WooCommerce")
        .single();

      if (!integrationData) {
        return {};
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {};
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("api_user_id", user.id)
        .single();

      if (!org) {
        return {};
      }

      const { data: accessData } = await supabase
        .from("organization_integration_access")
        .select("configuration")
        .eq("organization_id", org.id)
        .eq("integration_id", integrationData.id)
        .eq("is_active", true)
        .single();

      if (!accessData?.configuration) {
        return {};
      }

      const config = accessData.configuration as { endpoint?: string };
      if (!config.endpoint) {
        return {};
      }

      const endpointTemplate = config.endpoint.replace('GET ', '');
      
      // Fetch products directly from the frontend
      const linkedProducts: Record<string, WooLinkStatus> = {};
      
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        
        const promises = batch.map(async (productId: string) => {
          try {
            const url = endpointTemplate.replace('{calculator_id}', productId);
            
            const response = await fetch(url, {
              method: "GET",
              headers: {
                "Accept": "application/json",
              },
            });

            if (response.ok) {
              const data = await response.json();
              
              if (data.success && data.products && data.products.length > 0) {
                return {
                  productId,
                  data: {
                    isLinked: true,
                    wooProducts: data.products,
                    count: data.count || data.products.length
                  }
                };
              }
            }
            
            return {
              productId,
              data: {
                isLinked: false,
                wooProducts: [],
                count: 0
              }
            };
          } catch (err) {
            console.error(`Error checking product ${productId}:`, err);
            return {
              productId,
              data: {
                isLinked: false,
                wooProducts: [],
                count: 0
              }
            };
          }
        });
        
        const results = await Promise.all(promises);
        results.forEach(({ productId, data }) => {
          linkedProducts[productId] = data;
        });
      }

      return linkedProducts;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
