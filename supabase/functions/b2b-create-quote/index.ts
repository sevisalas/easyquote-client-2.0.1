import { corsHeaders } from "../_shared/cors.ts";
import {
  authenticatePortalUser,
  getEasyQuoteTokenForOrg,
  callEasyQuotePricing,
  applyCustomerTariff,
  extractPrice,
} from "../_shared/b2b-pricing-core.ts";

/**
 * Create a real quote on behalf of a B2B portal customer.
 * - Recomputes price authoritatively server-side (never trusts client prices)
 * - Applies customer tariff
 * - Generates a real quote_number via next_document_number_internal RPC
 * - Inserts into quotes + quote_items just like a salesperson would
 * - Creates as 'sent' so the customer can immediately approve from "Mis presupuestos"
 *   (or 'draft' if org has b2b_self_service_enabled = false → still review)
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
    const { items } = body as {
      items: Array<{ catalog_item_id: string; overrides?: Record<string, any> }>;
    };
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "items required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load org settings (self-service flag)
    const { data: org } = await ctx.admin
      .from("organizations")
      .select("b2b_self_service_enabled")
      .eq("id", ctx.customer.organization_id)
      .maybeSingle();
    const selfService = org?.b2b_self_service_enabled !== false;

    const token = await getEasyQuoteTokenForOrg(ctx.admin, ctx.customer.organization_id);
    if (!token) {
      return new Response(JSON.stringify({ error: "Motor de precios no disponible" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve all catalog items in one query
    const ids = items.map((i) => i.catalog_item_id);
    const { data: catalogRows } = await ctx.admin
      .from("b2b_catalog_items")
      .select("id, organization_id, name, product_id, default_prompts, exposed_prompt_ids, is_active")
      .in("id", ids);

    const catalogMap = new Map((catalogRows || []).map((r: any) => [r.id, r]));

    // Build per-item authoritative pricing + prompts
    const computedItems: Array<{
      name: string;
      product_id: string;
      prompts: Record<string, { label: string; value: any; order: number }>;
      price: number;
      description: string | null;
    }> = [];

    let subtotal = 0;

    for (const it of items) {
      const def: any = catalogMap.get(it.catalog_item_id);
      if (!def || !def.is_active || def.organization_id !== ctx.customer.organization_id) {
        return new Response(JSON.stringify({ error: `Producto inválido: ${it.catalog_item_id}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!def.product_id) continue;

      const defaults = (def.default_prompts as Record<string, any>) || {};
      const exposed = new Set((def.exposed_prompt_ids as string[]) || []);
      const merged: Record<string, any> = { ...defaults };
      for (const [k, v] of Object.entries(it.overrides || {})) {
        if (exposed.has(k)) merged[k] = v;
      }
      const inputs = Object.entries(merged).map(([id, value]) => ({ id, value }));
      const pricing = await callEasyQuotePricing(token, def.product_id, inputs);
      if (!pricing.ok) {
        return new Response(JSON.stringify({ error: `Error calculando precio: ${def.name}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const basePrice = extractPrice(pricing.data);
      const finalLine = await applyCustomerTariff(ctx.admin, ctx.customer.tariff_id, basePrice);
      subtotal += finalLine;

      // Build prompts map { id: { label, value, order } }
      const promptsMap: Record<string, { label: string; value: any; order: number }> = {};
      const apiPrompts: any[] = pricing.data?.prompts ?? [];
      const labelById = new Map<string, { label: string; order: number }>();
      apiPrompts.forEach((p: any, idx: number) => {
        const id = String(p.id);
        labelById.set(id, {
          label: p.promptText || p.label || id,
          order: p.promptSequence ?? p.order ?? idx,
        });
      });
      Object.entries(merged).forEach(([id, value], idx) => {
        const meta = labelById.get(String(id));
        promptsMap[id] = {
          label: meta?.label || id,
          value,
          order: meta?.order ?? idx,
        };
      });

      computedItems.push({
        name: def.name,
        product_id: def.product_id,
        prompts: promptsMap,
        price: finalLine,
        description: pricing.data?.description ?? null,
      });
    }

    if (computedItems.length === 0) {
      return new Response(JSON.stringify({ error: "Sin items válidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate quote number
    const { data: numData, error: numErr } = await ctx.admin.rpc(
      "next_document_number_internal",
      { p_organization_id: ctx.customer.organization_id, p_document_type: "quote" },
    );
    if (numErr || !numData?.[0]?.document_number) {
      console.error("b2b-create-quote: number generation failed", numErr);
      return new Response(JSON.stringify({ error: "No se pudo generar el número" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const quoteNumber: string = numData[0].document_number;

    const status = selfService ? "sent" : "draft";
    const finalPrice = subtotal;

    // Insert quote
    const { data: insertedQuote, error: qErr } = await ctx.admin
      .from("quotes")
      .insert({
        user_id: ctx.customer.user_id,
        customer_id: ctx.customer.id,
        organization_id: ctx.customer.organization_id,
        quote_number: quoteNumber,
        title: `Solicitud B2B — ${ctx.customer.name}`,
        status,
        subtotal: finalPrice,
        final_price: finalPrice,
        tax_amount: 0,
        discount_amount: 0,
        notes: "Generado automáticamente desde el portal B2B",
      })
      .select("id, quote_number")
      .single();

    if (qErr || !insertedQuote) {
      console.error("b2b-create-quote: quote insert failed", qErr);
      return new Response(JSON.stringify({ error: "No se pudo crear el presupuesto" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert items
    const itemRows = computedItems.map((c, idx) => ({
      quote_id: insertedQuote.id,
      product_id: c.product_id,
      product_name: c.name,
      name: c.name,
      prompts: c.prompts,
      outputs: {},
      price: c.price,
      quantity: 1,
      position: idx,
      description: c.description,
    }));
    const { error: iErr } = await ctx.admin.from("quote_items").insert(itemRows);
    if (iErr) {
      console.error("b2b-create-quote: items insert failed", iErr);
      // Rollback quote
      await ctx.admin.from("quotes").delete().eq("id", insertedQuote.id);
      return new Response(JSON.stringify({ error: "No se pudieron crear los items" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      quote_id: insertedQuote.id,
      quote_number: insertedQuote.quote_number,
      status,
      final_price: finalPrice,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("b2b-create-quote error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});