import { corsHeaders } from "../_shared/cors.ts";
import {
  authenticatePortalUser,
  getEasyQuoteTokenForOrg,
  callEasyQuotePricing,
  applyCustomerTariff,
  extractPrice,
} from "../_shared/b2b-pricing-core.ts";

/**
 * Public-facing pricing endpoint for the B2B portal.
 * The customer chooses values for "exposed" prompts; we merge them with the
 * admin's "default_prompts" and return the customer-facing price (after tariff).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ctx = await authenticatePortalUser(req.headers.get("Authorization"));
    if ("error" in ctx) {
      return new Response(JSON.stringify({ error: ctx.error }), {
        status: ctx.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { catalog_item_id, overrides } = body as {
      catalog_item_id: string;
      overrides?: Record<string, any>;
    };
    if (!catalog_item_id) {
      return new Response(JSON.stringify({ error: "catalog_item_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: item } = await ctx.admin
      .from("b2b_catalog_items")
      .select("id, organization_id, name, product_id, default_prompts, exposed_prompt_ids, is_active")
      .eq("id", catalog_item_id)
      .maybeSingle();

    if (!item || !item.is_active || item.organization_id !== ctx.customer.organization_id) {
      return new Response(JSON.stringify({ error: "Catalog item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!item.product_id) {
      return new Response(JSON.stringify({ error: "Producto no configurado por el comercial" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getEasyQuoteTokenForOrg(ctx.admin, item.organization_id);
    if (!token) {
      return new Response(JSON.stringify({ error: "Motor de precios no disponible" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge defaults + overrides (only for exposed prompt ids)
    const defaults = (item.default_prompts as Record<string, any>) || {};
    const exposed = new Set((item.exposed_prompt_ids as string[]) || []);
    const merged: Record<string, any> = { ...defaults };
    for (const [k, v] of Object.entries(overrides || {})) {
      if (exposed.has(k)) merged[k] = v;
    }

    const inputs = Object.entries(merged).map(([id, value]) => ({ id, value }));
    const pricing = await callEasyQuotePricing(token, item.product_id, inputs);

    if (!pricing.ok) {
      return new Response(JSON.stringify({
        error: "Error de cálculo",
        status: pricing.status,
        details: pricing.data,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basePrice = extractPrice(pricing.data);
    const finalPrice = await applyCustomerTariff(ctx.admin, ctx.customer.tariff_id, basePrice);

    return new Response(JSON.stringify({
      base_price: basePrice,
      final_price: finalPrice,
      description: pricing.data?.description ?? null,
      prompts: pricing.data?.prompts ?? [],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("b2b-pricing error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});