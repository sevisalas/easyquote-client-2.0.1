import { corsHeaders } from "../_shared/cors.ts";
import {
  authenticatePortalUser,
  getEasyQuoteTokenForOrg,
  resolveEasyQuotePricing,
  applyCustomerTariff,
  extractPrice,
  getHiddenPromptKeysForProduct,
  normalizePromptKey,
  extractPromptOverrideValues,
  callEasyQuotePricing,
} from "../_shared/b2b-pricing-core.ts";

/**
 * Public-facing pricing endpoint for the B2B portal.
 *
 * Source of truth for product configuration is the SAME definition the main app uses:
 *   - prompts come from EasyQuote pricing API
 *   - visibility comes from product_prompt_settings (shared by api_user_id)
 *
 * The catalog item only acts as a publication wrapper (which product, name, image,
 * description). It no longer carries its own "default_prompts" or "exposed_prompt_ids".
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
    const { catalog_item_id, overrides, skip_resolve } = body as {
      catalog_item_id: string;
      overrides?: Record<string, any>;
      skip_resolve?: boolean;
    };
    if (!catalog_item_id) {
      return new Response(JSON.stringify({ error: "catalog_item_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: item } = await ctx.admin
      .from("b2b_catalog_items")
      .select("id, organization_id, name, product_id, is_active")
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

    // Token + visibility config are independent — fetch in parallel.
    const [token, visibility] = await Promise.all([
      getEasyQuoteTokenForOrg(ctx.admin, item.organization_id),
      getHiddenPromptKeysForProduct(ctx.admin, item.organization_id, item.product_id),
    ]);

    if (!token) {
      return new Response(JSON.stringify({ error: "Motor de precios no disponible" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { hidden } = visibility;

    // EasyQuote pricing is stateless: each recalculation must include the full
    // resolved prompt state (defaults + hidden prefilled prompts + user overrides).
    // Fast path: if the client already holds the full prompt state (after the
    // first response), it sends `skip_resolve: true` and we do a single PATCH
    // instead of GET+PATCH — saves one EasyQuote roundtrip (~400-800ms).
    let pricing;
    if (skip_resolve && overrides && Object.keys(overrides).length > 0) {
      const values = extractPromptOverrideValues(overrides);
      const inputs = Object.entries(values)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([id, value]) => ({ id, value }));
      pricing = await callEasyQuotePricing(token, item.product_id, inputs);
    } else {
      pricing = await resolveEasyQuotePricing(token, item.product_id, overrides || {});
    }

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

    // Filter out prompts marked as hidden / admin_only in the main app.
    const apiPrompts: any[] = pricing.data?.prompts ?? [];
    const visiblePrompts = apiPrompts.filter((p: any) => {
      const keys = [p.id, p.promptText, p.label].map(normalizePromptKey);
      return !keys.some((k) => k && hidden.has(k));
    });

    return new Response(JSON.stringify({
      base_price: basePrice,
      final_price: finalPrice,
      description: pricing.data?.description ?? null,
      prompts: visiblePrompts,
      outputs: pricing.data?.outputs ?? [],
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
