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
    const { api_key, woo_products } = body;

    console.log("sync-woocommerce-products: Received sync request", { 
      wooProductCount: woo_products?.length,
      hasApiKey: !!api_key 
    });

    if (!api_key) {
      return new Response(JSON.stringify({ error: "Missing api_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(woo_products)) {
      return new Response(JSON.stringify({ error: "woo_products must be an array" }), {
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

    // First, clear all existing links for this organization
    const { error: deleteError } = await supabase
      .from("woocommerce_product_links")
      .delete()
      .eq("organization_id", organizationId);

    if (deleteError) {
      console.error("Error clearing old links:", deleteError);
    }

    // Group WooCommerce products by calculator_id
    const productsByCalculator: Record<string, any[]> = {};
    for (const wooProduct of woo_products) {
      const calculatorId = wooProduct.calculator_id;
      if (!calculatorId) continue;
      
      if (!productsByCalculator[calculatorId]) {
        productsByCalculator[calculatorId] = [];
      }
      productsByCalculator[calculatorId].push(wooProduct);
    }

    // Create records for each calculator_id with its linked WooCommerce products
    const productsToInsert = Object.entries(productsByCalculator).map(([calculatorId, wooProds]) => ({
      organization_id: organizationId,
      easyquote_product_id: calculatorId,
      easyquote_product_name: calculatorId, // Will be updated when frontend fetches EasyQuote products
      woo_products: wooProds,
      is_linked: true,
      product_count: wooProds.length,
      last_synced_at: new Date().toISOString(),
    }));

    if (productsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("woocommerce_product_links")
        .insert(productsToInsert);

      if (insertError) {
        console.error("Error inserting products:", insertError);
        return new Response(JSON.stringify({ error: "Failed to sync products", details: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`✅ Successfully synced ${productsToInsert.length} linked calculators (${woo_products.length} WooCommerce products) for organization ${organizationId}`);

    return new Response(JSON.stringify({ 
      success: true,
      synced_calculators: productsToInsert.length,
      synced_woo_products: woo_products.length,
      message: `Successfully synced ${productsToInsert.length} linked calculators with ${woo_products.length} WooCommerce products`
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