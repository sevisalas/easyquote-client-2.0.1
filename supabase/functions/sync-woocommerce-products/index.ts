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

    const body = await req.json();
    const { api_key, products } = body;

    console.log("sync-woocommerce-products: Received sync request", { 
      productCount: products?.length,
      hasApiKey: !!api_key 
    });

    if (!api_key) {
      return new Response(JSON.stringify({ error: "Missing api_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(products)) {
      return new Response(JSON.stringify({ error: "Products must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find organization by API key
    const { data: credential, error: credError } = await supabase
      .from("organization_api_credentials")
      .select("organization_id")
      .eq("api_key", api_key)
      .eq("is_active", true)
      .single();

    if (credError || !credential) {
      console.error("Invalid API key:", credError);
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = credential.organization_id;
    console.log("sync-woocommerce-products: Found organization", { organizationId });

    // Update usage count
    await supabase
      .from("organization_api_credentials")
      .update({ 
        last_used_at: new Date().toISOString()
      })
      .eq("api_key", api_key);

    // Upsert products
    const productsToUpsert = products.map(product => ({
      organization_id: organizationId,
      easyquote_product_id: product.calculator_id,
      easyquote_product_name: product.product_name || product.calculator_id,
      woo_products: product.woo_products || [],
      is_linked: (product.woo_products?.length || 0) > 0,
      product_count: product.woo_products?.length || 0,
      last_synced_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("woocommerce_product_links")
      .upsert(productsToUpsert, {
        onConflict: "organization_id,easyquote_product_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Error upserting products:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to sync products", details: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Successfully synced ${productsToUpsert.length} products for organization ${organizationId}`);

    return new Response(JSON.stringify({ 
      success: true,
      synced: productsToUpsert.length,
      message: `Successfully synced ${productsToUpsert.length} products`
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