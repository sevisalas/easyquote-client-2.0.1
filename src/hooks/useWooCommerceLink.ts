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

      const { data, error } = await supabase.functions.invoke('woocommerce-product-check', {
        body: { productIds }
      });

      if (error) {
        console.error('Error checking WooCommerce links:', error);
        return {};
      }

      return data.linkedProducts as Record<string, WooLinkStatus>;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
