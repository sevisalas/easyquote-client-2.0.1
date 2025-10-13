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
        const url = endpointTemplate.replace('{calculator_id}', productId);
        console.log(`Checking WooCommerce for product: ${productId} at ${url}`);
        
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
