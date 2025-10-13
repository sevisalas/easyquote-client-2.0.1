import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { productIds } = await req.json();
    console.log("woocommerce-product-check: Checking products", { productIds });
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return new Response(JSON.stringify({ linkedProducts: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check each product ID against WooCommerce
    const linkedProducts: Record<string, any> = {};
    
    for (const productId of productIds) {
      try {
        const url = `https://reprotel.online/wp-json/easyquote/v1/products-by-calculator/${productId}`;
        console.log(`Checking WooCommerce for product: ${productId}`);
        
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.products && data.products.length > 0) {
            linkedProducts[productId] = {
              isLinked: true,
              wooProducts: data.products,
              count: data.count
            };
          } else {
            linkedProducts[productId] = {
              isLinked: false,
              wooProducts: [],
              count: 0
            };
          }
        } else {
          console.warn(`Failed to check product ${productId}:`, response.status);
          linkedProducts[productId] = {
            isLinked: false,
            wooProducts: [],
            count: 0
          };
        }
      } catch (err) {
        console.error(`Error checking product ${productId}:`, err);
        linkedProducts[productId] = {
          isLinked: false,
          wooProducts: [],
          count: 0
        };
      }
    }

    return new Response(JSON.stringify({ linkedProducts }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("woocommerce-product-check: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
