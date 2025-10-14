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

      // Get current user's organization
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

      // Fetch product links from the database
      const { data: productLinks, error } = await supabase
        .from("woocommerce_product_links")
        .select("*")
        .eq("organization_id", org.id)
        .in("easyquote_product_id", productIds);

      if (error) {
        console.error("Error fetching product links:", error);
        return {};
      }

      // Build the result object
      const linkedProducts: Record<string, WooLinkStatus> = {};
      
      productIds.forEach(productId => {
        const link = productLinks?.find(l => l.easyquote_product_id === productId);
        
        if (link) {
          linkedProducts[productId] = {
            isLinked: link.is_linked,
            wooProducts: (link.woo_products as unknown as WooProduct[]) || [],
            count: link.product_count
          };
        } else {
          linkedProducts[productId] = {
            isLinked: false,
            wooProducts: [],
            count: 0
          };
        }
      });

      return linkedProducts;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
