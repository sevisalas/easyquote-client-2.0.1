import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// ---------- helpers (mirror src/utils/approvedMultiQuantity.ts) ----------
const AUTO_DESCRIPTION_EXCLUDED_LABELS = [
  "tarifa", "forzar máquina", "forzar maquina", "tira y retira",
  "forzar poses", "forzar poses/pags.", "modelos",
];

const normalizePromptKey = (v: any) =>
  String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

const parseQuantity = (v: any): number => {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 1;
  const raw = String(v ?? "").trim();
  if (!raw) return 1;
  const norm = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const p = parseFloat(norm);
  return Number.isFinite(p) && p > 0 ? p : 1;
};

const parseLocaleNumber = (v: any): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v ?? "").trim();
  if (!raw) return 0;
  const norm = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const p = parseFloat(norm);
  return Number.isFinite(p) ? p : 0;
};

const promptsToArray = (prompts: any): any[] => {
  if (Array.isArray(prompts)) {
    return prompts
      .filter((p: any) => p && (p.id || p.name || p.label))
      .map((p: any, i: number) => ({
        ...p,
        id: String(p.id || p.name || p.label || `prompt-${i}`),
        label: p.label || String(p.id || p.name || p.label || `Prompt ${i + 1}`),
        order: p.order ?? i,
      }));
  }
  if (prompts && typeof prompts === "object") {
    return Object.entries(prompts).map(([id, p]: [string, any], i: number) => ({
      id, label: p?.label || id, value: p?.value, order: p?.order ?? i,
    }));
  }
  return [];
};

const findQuantityPromptIndex = (arr: any[]) => {
  const cIdx = arr.findIndex((p) => String(p.id || "").trim() === "custom_quantity");
  if (cIdx >= 0) return cIdx;
  return arr.findIndex((p) => {
    const t = normalizePromptKey(p.label || p.id || "");
    return t.includes("CANTIDAD") || t.includes("UNIDADES") || t.includes("EJEMPLAR")
      || t.includes("QUANTITY") || t === "QTY";
  });
};

const syncPromptsWithQuantity = (prompts: any, qty: number) => {
  const arr = [...promptsToArray(prompts)];
  const idx = findQuantityPromptIndex(arr);
  if (idx >= 0) arr[idx] = { ...arr[idx], value: String(qty) };
  return arr;
};

const buildAutoDescriptionFromPrompts = (prompts: any) =>
  promptsToArray(prompts)
    .filter((p) => {
      const v = String(p?.value ?? "").trim();
      const l = String(p?.label ?? "").toLowerCase().trim();
      if (!v || v.toLowerCase() === "no") return false;
      if (AUTO_DESCRIPTION_EXCLUDED_LABELS.some((e) => l.includes(e))) return false;
      return true;
    })
    .map((p) => `${p.label}: ${String(p.value).trim()}`)
    .join("\n");

const applyItemAdditionals = (basePrice: number, item: any, quantity: number): number => {
  const additionals = item?.item_additionals;
  if (!Array.isArray(additionals) || additionals.length === 0) return basePrice;
  const qtyInputs: number[] = item?.multi?.qtyInputs || [];
  const qtyIndex = qtyInputs.findIndex((q: number) => Number(q) === Number(quantity));
  let total = basePrice;
  for (const a of additionals) {
    let value = a.value || 0;
    if (a.type === "net_amount" && Array.isArray(a.multiValues)
        && qtyIndex >= 0 && qtyIndex < a.multiValues.length) {
      value = Number(a.multiValues[qtyIndex]) || value;
    }
    const isDiscount = a.is_discount === true || value < 0;
    if (isDiscount) {
      if (a.type === "net_amount") total -= Math.abs(value);
      else if (a.type === "percentage") total -= Math.abs((total * value) / 100);
      continue;
    }
    switch (a.type) {
      case "net_amount": total += value; break;
      case "percentage": total += (total * value) / 100; break;
      case "quantity_multiplier": total += value * quantity; break;
      case "capacity_divider": {
        const cap = a.capacity_value || 1;
        total += value * Math.ceil(quantity / cap);
        break;
      }
    }
  }
  return total;
};

const isCustomProductItem = (item: any) =>
  String(item?.product_id ?? "").trim() === "__CUSTOM_PRODUCT__";

// ---------- main approval logic (port of useQuoteApproval) ----------
async function approveQuoteCore(
  supabase: any,
  params: {
    quoteId: string;
    selectedItemIds?: string[];
    itemQuantities?: Record<string, number>;
    actorUserId?: string | null;
    bypassRoleCheck?: boolean;
  },
) {
  const { quoteId, selectedItemIds, itemQuantities, actorUserId, bypassRoleCheck } = params;

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*, items:quote_items(*)")
    .eq("id", quoteId)
    .single();
  if (quoteError) throw quoteError;
  if (!quote) throw new Error("Presupuesto no encontrado");

  // Block duplicate
  const { data: existingOrder } = await supabase
    .from("sales_orders")
    .select("id, order_number")
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (existingOrder) {
    throw new Error(`Este presupuesto ya tiene un pedido asociado (${existingOrder.order_number}).`);
  }

  const itemsToApprove = selectedItemIds && selectedItemIds.length > 0
    ? quote.items.filter((it: any) => selectedItemIds.includes(it.id))
    : quote.items;
  if (!itemsToApprove?.length) throw new Error("No hay items para aprobar");

  for (const it of itemsToApprove) {
    const m = it.multi as any;
    if (m?.rows && Array.isArray(m.rows) && m.rows.length > 1) {
      if (!itemQuantities || !itemQuantities[it.id]) {
        throw new Error("Debes seleccionar una cantidad para cada item con múltiples opciones");
      }
    }
  }

  const organizationId = quote.organization_id;
  if (!organizationId) throw new Error("No se pudo determinar la organización");

  // Order number with retry
  let orderNumber = "";
  for (let i = 0; i < 3; i++) {
    const { data: docNumber, error: docErr } = await supabase
      .rpc("next_document_number", { p_organization_id: organizationId, p_document_type: "order" });
    if (docErr || !docNumber?.length) throw new Error("Error generando número de pedido");
    orderNumber = docNumber[0].document_number;
    const { data: ex } = await supabase
      .from("sales_orders")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (!ex) break;
    if (i === 2) throw new Error("No se pudo generar un número de pedido único");
  }

  // Quantity prompt resolution from settings
  const quantityPromptByProduct = new Map<string, { promptName: string; label: string | null }>();
  const productIds = Array.from(new Set(
    itemsToApprove.map((it: any) => String(it.product_id ?? "").trim()).filter(Boolean)
  ));
  if (productIds.length > 0) {
    const { data: qs } = await supabase
      .from("product_prompt_settings")
      .select("easyquote_product_id, prompt_name, label")
      .eq("organization_id", organizationId)
      .eq("is_quantity", true)
      .in("easyquote_product_id", productIds);
    for (const r of qs || []) {
      if (!quantityPromptByProduct.has(r.easyquote_product_id)) {
        quantityPromptByProduct.set(r.easyquote_product_id, { promptName: r.prompt_name, label: r.label });
      }
    }
  }

  const resolveQtyStrict = (item: any): number | null => {
    const arr = promptsToArray(item.prompts);
    const setting = item.product_id ? quantityPromptByProduct.get(String(item.product_id)) : undefined;
    if (setting) {
      const nName = normalizePromptKey(setting.promptName);
      const nLabel = setting.label ? normalizePromptKey(setting.label) : "";
      const idx = arr.findIndex((p: any) => {
        const pn = normalizePromptKey(p?.name || p?.id || "");
        const pl = normalizePromptKey(p?.label || "");
        return pn === nName || pl === nName || (nLabel && (pn === nLabel || pl === nLabel));
      });
      if (idx >= 0) {
        const q = parseQuantity(arr[idx]?.value);
        if (q > 0) return q;
      }
    }
    const idx2 = findQuantityPromptIndex(arr);
    if (idx2 >= 0) {
      const q = parseQuantity(arr[idx2]?.value);
      if (q > 0) return q;
    }
    if (item.accepted_quantity) return parseQuantity(item.accepted_quantity);
    if (item.quantity) return parseQuantity(item.quantity);
    return null;
  };

  const resolveQty = (item: any): number => {
    const s = resolveQtyStrict(item);
    if (s !== null) return s;
    if (isCustomProductItem(item)) return 1;
    throw new Error(`No se pudo resolver la cantidad del item ${item.product_name || item.id}`);
  };

  const customBasePrice = (item: any, quantity: number): number => {
    const arr = promptsToArray(item.prompts);
    const cp = arr.find((p: any) => String(p?.id || p?.name || "").trim() === "custom_unit_price");
    const unit = parseLocaleNumber(cp?.value);
    const sQty = resolveQtyStrict(item);
    if (unit > 0 && sQty !== null && sQty > 0) return unit * sQty;
    return parseLocaleNumber(item.price || 0);
  };

  // Subtotal
  let subtotal = 0;
  for (const item of itemsToApprove) {
    const m = item.multi as any;
    const rq = resolveQty(item);
    let price = isCustomProductItem(item)
      ? applyItemAdditionals(customBasePrice(item, rq), item, rq)
      : (item.price || 0);
    if (m?.rows?.length && itemQuantities?.[item.id]) {
      const sQ = itemQuantities[item.id];
      const row = m.rows.find((r: any) => parseQuantity(r.qty) === sQ || parseQuantity(r.quantity) === sQ);
      if (row) {
        const base = parseFloat(row.outs?.find((o: any) => o.type === "Price")?.value || row.price || item.price || 0);
        price = applyItemAdditionals(base, item, sQ);
      }
    }
    subtotal += price;
  }

  // Additionals
  const { data: quoteAdditionals } = await supabase
    .from("quote_additionals").select("*").eq("quote_id", quoteId);
  let discountAmount = 0, taxAmount = 0;
  for (const a of quoteAdditionals || []) {
    if (a.is_discount) {
      discountAmount += a.type === "percentage" ? (subtotal * a.value) / 100 : a.value;
    } else {
      taxAmount += a.type === "percentage" ? (subtotal * a.value) / 100 : a.value;
    }
  }
  const finalPrice = subtotal - discountAmount + taxAmount;

  // Create order
  const { data: salesOrder, error: orderError } = await supabase
    .from("sales_orders")
    .insert({
      order_number: orderNumber,
      quote_id: quoteId,
      customer_id: quote.customer_id,
      user_id: quote.user_id,
      organization_id: quote.organization_id,
      status: "pending",
      description: quote.description,
      terms_conditions: quote.terms_conditions,
      valid_until: quote.valid_until,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      final_price: finalPrice,
      notes: quote.notes,
      created_from_scratch: false,
    })
    .select()
    .single();
  if (orderError) throw orderError;

  if (quoteAdditionals?.length) {
    await supabase.from("sales_order_additionals").insert(
      quoteAdditionals.map((qa: any) => ({
        sales_order_id: salesOrder.id,
        additional_id: qa.additional_id,
        name: qa.name, type: qa.type, value: qa.value, is_discount: qa.is_discount,
      }))
    );
  }

  // Build order items
  const orderItems = itemsToApprove.map((item: any, index: number) => {
    const m = item.multi as any;
    let finalQuantity = resolveQty(item);
    if (m?.rows?.length > 1 && itemQuantities?.[item.id]) finalQuantity = itemQuantities[item.id];

    const isCustom = isCustomProductItem(item);
    let fPrice = item.price || 0;
    let fMulti = item.multi;
    let fOutputs = Array.isArray(item.outputs) ? item.outputs : [];
    let fPrompts = syncPromptsWithQuantity(item.prompts, finalQuantity);
    const isDescManual = item.description_manual === true;
    let fDesc = item.description;

    if (isCustom) {
      fPrice = applyItemAdditionals(customBasePrice(item, finalQuantity), item, finalQuantity);
    }

    if (m?.rows?.length > 1 && itemQuantities?.[item.id]) {
      const sQ = itemQuantities[item.id];
      const row = m.rows.find((r: any) => parseQuantity(r.qty) === sQ || parseQuantity(r.quantity) === sQ);
      fPrompts = syncPromptsWithQuantity(item.prompts, sQ);
      if (row) {
        const base = parseFloat(row.outs?.find((o: any) => o.type === "Price")?.value || row.price || item.price || 0);
        fPrice = applyItemAdditionals(base, item, sQ);
        fOutputs = Array.isArray(row.outs) ? row.outs : fOutputs;
        fMulti = { ...m, rows: [row] };
      }
    }

    if (m?.rows?.length === 1) {
      const row = m.rows[0];
      const base = parseFloat(row.outs?.find((o: any) => o.type === "Price")?.value || row.price || item.price || 0);
      const rq = parseQuantity(row.qty) || parseQuantity(row.quantity) || finalQuantity;
      fPrice = applyItemAdditionals(base, item, rq);
      fOutputs = Array.isArray(row.outs) ? row.outs : fOutputs;
    }

    if (isCustom) fDesc = item.description || fDesc || "";
    else if (isDescManual && fDesc?.trim()) { /* keep */ }
    else fDesc = buildAutoDescriptionFromPrompts(fPrompts) || fDesc || "";

    return {
      sales_order_id: salesOrder.id,
      product_id: item.product_id,
      product_name: item.name || item.product_name,
      description: fDesc,
      description_manual: isCustom ? true : isDescManual,
      quantity: finalQuantity,
      price: fPrice,
      outputs: fOutputs,
      prompts: fPrompts,
      multi: fMulti,
      position: index,
      composite_data: item.composite_data || null,
      item_additionals: item.item_additionals || null,
    };
  });

  const { error: itemsError } = await supabase.from("sales_order_items").insert(orderItems);
  if (itemsError) {
    await supabase.from("sales_orders").delete().eq("id", salesOrder.id);
    throw itemsError;
  }

  // Copy attachments
  try {
    const { data: atts } = await supabase
      .from("document_attachments")
      .select("*")
      .eq("quote_id", quoteId);
    if (atts?.length) {
      await supabase.from("document_attachments").insert(
        atts.map((a: any) => ({
          organization_id: a.organization_id,
          sales_order_id: salesOrder.id,
          file_name: a.file_name, file_path: a.file_path,
          file_size: a.file_size, mime_type: a.mime_type,
          created_by: a.created_by,
        }))
      );
    }
  } catch (e) { console.error("attachments copy failed (non-fatal):", e); }

  // Mark accepted/non-accepted
  const allItemIds = quote.items.map((it: any) => it.id);
  const approvedIds = itemsToApprove.map((it: any) => it.id);
  const nonApprovedIds = allItemIds.filter((id: string) => !approvedIds.includes(id));

  for (let i = 0; i < orderItems.length; i++) {
    const oi = orderItems[i];
    const src = itemsToApprove[i];
    await supabase.from("quote_items").update({
      accepted: true,
      accepted_quantity: oi.quantity,
      quantity: oi.quantity,
      price: oi.price,
      prompts: oi.prompts,
      outputs: oi.outputs,
      multi: oi.multi,
      description: oi.description,
    }).eq("id", src.id);
  }
  if (nonApprovedIds.length) {
    await supabase.from("quote_items").update({ accepted: false }).in("id", nonApprovedIds);
  }

  // Update quote totals + status
  const updatedSelections = Array.isArray(quote.selections)
    ? quote.selections.map((sel: any) => {
        const match = orderItems.find((oi: any) => {
          const sp = String(sel?.productId ?? "").trim();
          const sn = String(sel?.displayName || sel?.productName || sel?.itemDescription || "").trim();
          return (sp && sp === String(oi.product_id ?? "").trim()) || sn === String(oi.product_name || "").trim();
        });
        if (!match) return sel;
        return {
          ...sel, price: match.price, outputs: match.outputs, prompts: match.prompts,
          multi: match.multi, itemDescription: match.description, descriptionManual: match.description_manual,
        };
      })
    : quote.selections;

  await supabase.from("quotes").update({
    status: "approved",
    subtotal,
    final_price: finalPrice,
    selections: updatedSelections,
  }).eq("id", quoteId);

  // Holded exports — best effort
  try {
    const { data: holdedConfig } = await supabase
      .from("holded_integration_settings")
      .select("export_quotes_mode, is_active")
      .eq("organization_id", organizationId)
      .maybeSingle();
    const active = holdedConfig?.is_active === true;
    const mode = holdedConfig?.export_quotes_mode || "all";
    if (active && (mode === "estimates_on_approval")) {
      await supabase.functions.invoke("holded-export-estimate", {
        body: { quoteId, approvedItemIds: approvedIds },
      });
    }
    if (active && (mode === "all" || mode === "orders_only" || mode === "estimates_on_approval")) {
      await supabase.functions.invoke("holded-export-order", { body: { orderId: salesOrder.id } });
    }
  } catch (e) { console.error("Holded export failed (non-fatal):", e); }

  return { salesOrder, orderNumber };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { quoteId, selectedItemIds, itemQuantities } = body || {};
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "quoteId requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const result = await approveQuoteCore(supabase, {
      quoteId, selectedItemIds, itemQuantities, bypassRoleCheck: true,
    });
    return new Response(JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("approve-quote error:", e);
    return new Response(JSON.stringify({ error: e.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});