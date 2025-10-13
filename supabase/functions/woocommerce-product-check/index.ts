import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("api_user_id", user.id)
      .single();

    if (orgError || !org) {
      console.error("Organization not found:", orgError);
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WooCommerce integration configuration
    const { data: integrationData, error: integrationError } = await supabase
      .from("integrations")
      .select("id")
      .eq("name", "WooCommerce")
      .single();

    if (integrationError || !integrationData) {
      console.error("WooCommerce integration not found:", integrationError);
      return new Response(JSON.stringify({ error: "WooCommerce integration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: accessData, error: accessError } = await supabase
      .from("organization_integration_access")
      .select("configuration")
      .eq("organization_id", org.id)
      .eq("integration_id", integrationData.id)
      .eq("is_active", true)
      .single();

    if (accessError || !accessData || !accessData.configuration?.endpoint) {
      console.error("WooCommerce configuration not found:", accessError);
      return new Response(JSON.stringify({ linkedProducts: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpointTemplate = accessData.configuration.endpoint.replace('GET ', '');
    const consumerKey = accessData.configuration.consumer_key;
    const consumerSecret = accessData.configuration.consumer_secret;

    const { productIds } = await req.json();
    console.log("woocommerce-product-check: Checking products", { productIds });
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return new Response(JSON.stringify({ linkedProducts: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check each product ID against WooCommerce in parallel
    const linkedProducts: Record<string, any> = {};
    
    // Process products in batches of 20 to avoid overwhelming the server
    const batchSize = 20;
    const batches = [];
    
    for (let i = 0; i < productIds.length; i += batchSize) {
      batches.push(productIds.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${productIds.length} products in ${batches.length} batches of ${batchSize}`);
    
    for (const batch of batches) {
      const promises = batch.map(async (productId: string) => {
        try {
          let url = endpointTemplate.replace('{calculator_id}', productId);
          
          // Add authentication params to URL
          if (consumerKey && consumerSecret) {
            const urlObj = new URL(url);
            urlObj.searchParams.set('consumer_key', consumerKey);
            urlObj.searchParams.set('consumer_secret', consumerSecret);
            url = urlObj.toString();
          }
          
          const response = await fetch(url, {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`Product ${productId}: success=${data.success}, count=${data.count}, hasProducts=${!!data.products}`);
            
            if (data.success && data.products && data.products.length > 0) {
              console.log(`✅ Product ${productId} is linked with ${data.products.length} WooCommerce products`);
              return {
                productId,
                data: {
                  isLinked: true,
                  wooProducts: data.products,
                  count: data.count || data.products.length
                }
              };
            }
          } else {
            console.log(`Product ${productId}: HTTP ${response.status}`);
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

    const linkedCount = Object.values(linkedProducts).filter((p: any) => p.isLinked).length;
    console.log(`✅ Finished processing ${productIds.length} products. ${linkedCount} are linked to WooCommerce`);

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
