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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { organizationId, products } = await req.json();
    console.log("sync-woocommerce-products: Syncing products", { organizationId, productCount: products?.length });
    
    if (!organizationId || !Array.isArray(products)) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: organizationId and products array" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      console.error("Organization not found:", orgError);
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert each product link
    const upsertPromises = products.map(async (product: any) => {
      const { 
        easyquote_product_id, 
        easyquote_product_name,
        woo_products = [],
        is_linked = false,
        product_count = 0
      } = product;

      if (!easyquote_product_id || !easyquote_product_name) {
        console.warn("Skipping product with missing data:", product);
        return null;
      }

      return supabase
        .from("woocommerce_product_links")
        .upsert({
          organization_id: organizationId,
          easyquote_product_id,
          easyquote_product_name,
          woo_products,
          is_linked,
          product_count,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: "organization_id,easyquote_product_id"
        });
    });

    const results = await Promise.all(upsertPromises);
    const errors = results.filter(r => r && r.error);

    if (errors.length > 0) {
      console.error("Some products failed to sync:", errors);
      return new Response(JSON.stringify({ 
        error: "Some products failed to sync",
        details: errors 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Successfully synced ${products.length} products for organization ${organizationId}`);

    return new Response(JSON.stringify({ 
      success: true,
      synced: products.length,
      message: `Successfully synced ${products.length} products`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-woocommerce-products: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error", details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
