// Shared helpers for B2B portal autoservice (pricing + quote creation)
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export interface PortalContext {
  admin: SupabaseClient;
  portalUserId: string;
  customer: {
    id: string;
    name: string;
    organization_id: string;
    user_id: string;
    tariff_id: string | null;
  };
}

export async function authenticatePortalUser(
  authHeader: string | null,
): Promise<PortalContext | { error: string; status: number }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const jwt = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(jwt);
  if (claimsErr || !claims?.claims?.sub) {
    return { error: "Invalid session", status: 401 };
  }
  const portalUserId = claims.claims.sub as string;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: customer } = await admin
    .from("customers")
    .select("id, name, organization_id, user_id, tariff_id, portal_user_id, portal_enabled")
    .eq("portal_user_id", portalUserId)
    .maybeSingle();

  if (!customer || !customer.portal_enabled) {
    return { error: "Portal access disabled", status: 403 };
  }

  return {
    admin,
    portalUserId,
    customer: {
      id: customer.id,
      name: customer.name,
      organization_id: customer.organization_id,
      user_id: customer.user_id,
      tariff_id: customer.tariff_id,
    },
  };
}

/**
 * Get a fresh EasyQuote API token for the organization owner.
 */
export async function getEasyQuoteTokenForOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data: org } = await admin
    .from("organizations")
    .select("api_user_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org?.api_user_id) return null;

  const { data: creds } = await admin.rpc("get_organization_easyquote_credentials", {
    p_user_id: org.api_user_id,
  });
  const cred = creds?.[0];
  if (!cred?.api_username || !cred?.api_password) return null;

  const loginRes = await fetch("https://api.easyquote.cloud/api/v1/users/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cred.api_username, password: cred.api_password }),
  });
  if (!loginRes.ok) return null;
  const data = await loginRes.json();
  return data?.token ?? null;
}

/**
 * Call EasyQuote pricing API directly (bypasses easyquote-pricing function for less overhead).
 * Returns full pricing response.
 */
export async function callEasyQuotePricing(
  token: string,
  productId: string,
  inputs: Array<{ id: string; value: any }>,
): Promise<{ ok: boolean; status: number; data: any }> {
  // Sanitize inputs (mirror easyquote-pricing logic minimally)
  const formatted = inputs
    .filter((i) => i.value !== null && i.value !== undefined && i.value !== "")
    .map((i) => {
      let v: any = i.value;
      if (typeof v === "boolean") v = v ? "Sí" : "No";
      if (typeof v === "number" && !Number.isInteger(v)) v = v.toString().replace(".", ",");
      return { id: String(i.id), value: v };
    });

  const url = `https://api.easyquote.cloud/api/v1/pricing/${productId}?_t=${Date.now()}`;
  const method = formatted.length > 0 ? "PATCH" : "GET";
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
      "Cache-Control": "no-cache",
    },
    ...(method === "PATCH" ? { body: JSON.stringify(formatted) } : {}),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  console.log("[b2b-pricing-core] EasyQuote response", {
    productId,
    method,
    status: res.status,
    ok: res.ok,
    inputsCount: formatted.length,
    textLength: text.length,
    preview: text.slice(0, 500),
  });
  return { ok: res.ok, status: res.status, data };
}

export function extractPromptOverrideValues(
  promptMap?: Record<string, any> | null,
): Record<string, any> {
  const values: Record<string, any> = {};
  for (const [id, raw] of Object.entries(promptMap || {})) {
    values[String(id)] = raw && typeof raw === "object" && "value" in raw
      ? raw.value
      : raw;
  }
  return values;
}

export function buildResolvedPricingInputs(
  pricingData: any,
  overrides?: Record<string, any> | null,
): Array<{ id: string; value: any }> {
  const resolvedOverrides = extractPromptOverrideValues(overrides);
  const prompts = Array.isArray(pricingData?.prompts) ? pricingData.prompts : [];
  const inputs: Array<{ id: string; value: any }> = [];
  const seen = new Set<string>();

  for (const prompt of prompts) {
    const id = String(prompt?.id ?? "").trim();
    if (!id) continue;
    seen.add(id);

    const value = resolvedOverrides[id] !== undefined
      ? resolvedOverrides[id]
      : (prompt?.currentValue ?? prompt?.defaultValue ?? prompt?.selectedValue);

    if (value === undefined || value === null || value === "") continue;
    inputs.push({ id, value });
  }

  for (const [id, value] of Object.entries(resolvedOverrides)) {
    const normalizedId = String(id).trim();
    if (!normalizedId || seen.has(normalizedId)) continue;
    if (value === undefined || value === null || value === "") continue;
    inputs.push({ id: normalizedId, value });
  }

  return inputs;
}

export async function resolveEasyQuotePricing(
  token: string,
  productId: string,
  overrides?: Record<string, any> | null,
): Promise<{ ok: boolean; status: number; data: any }> {
  const initial = await callEasyQuotePricing(token, productId, []);
  if (!initial.ok) return initial;

  const resolvedInputs = buildResolvedPricingInputs(initial.data, overrides);
  if (resolvedInputs.length === 0) {
    return initial;
  }

  return await callEasyQuotePricing(token, productId, resolvedInputs);
}

/**
 * Apply customer tariff (single percentage discount/surcharge) to a base price.
 */
export async function applyCustomerTariff(
  admin: SupabaseClient,
  tariffId: string | null,
  basePrice: number,
): Promise<number> {
  if (!tariffId) return basePrice;
  const { data: tariff } = await admin
    .from("tariffs")
    .select("percentage, is_discount, is_active")
    .eq("id", tariffId)
    .maybeSingle();
  if (!tariff || !tariff.is_active) return basePrice;
  const adj = (basePrice * Number(tariff.percentage)) / 100;
  return tariff.is_discount ? basePrice - adj : basePrice + adj;
}

/**
 * Extract a numeric price from a pricing API response.
 */
export function extractPrice(pricingData: any): number {
  const parseEs = (val: any): number => {
    if (typeof val === "number") return val;
    if (val == null) return NaN;
    const n = parseFloat(String(val).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  // Source of truth: outputs with type === "Price" (matches main app QuoteItem logic).
  const outputs: any[] = Array.isArray(pricingData?.outputs)
    ? pricingData.outputs
    : Array.isArray(pricingData?.outputValues)
      ? pricingData.outputValues
      : [];

  let prices = outputs.filter((o) => String(o?.type || "").toLowerCase() === "price");
  if (prices.length === 0) {
    prices = outputs.filter((o) => {
      const name = String(o?.name || o?.label || "").toLowerCase();
      return name.includes("precio") || name.includes("price");
    });
  }

  if (prices.length > 0) {
    // Prefer "total" if any
    const totalLike = prices.find((o) => /total/i.test(String(o?.name ?? o?.label ?? "")));
    if (totalLike) {
      const n = parseEs(totalLike.value ?? totalLike.calculatedValue);
      if (Number.isFinite(n)) return n;
    }
    // Otherwise pick the largest numeric (mirrors main app)
    const nums = prices
      .map((o) => parseEs(o.value ?? o.calculatedValue))
      .filter((n) => Number.isFinite(n));
    if (nums.length > 0) return Math.max(...nums);
  }

  // Last-resort fallbacks (rare)
  const direct = parseEs(pricingData?.price);
  if (Number.isFinite(direct)) return direct;

  return 0;
}

/**
 * Load the prompt visibility config that the main app uses (product_prompt_settings),
 * shared by api_user_id (sister organizations).
 * Returns a Set of normalized prompt keys (UPPERCASE, no `$`) that must be HIDDEN
 * to the portal customer (either is_hidden or admin_only).
 */
export async function getHiddenPromptKeysForProduct(
  admin: SupabaseClient,
  organizationId: string,
  productId: string,
): Promise<{ hidden: Set<string>; settingsByKey: Map<string, any> }> {
  const { data: org } = await admin
    .from("organizations")
    .select("api_user_id")
    .eq("id", organizationId)
    .maybeSingle();
  const apiUserId = (org as any)?.api_user_id;
  const hidden = new Set<string>();
  const settingsByKey = new Map<string, any>();
  if (!apiUserId) return { hidden, settingsByKey };

  const { data } = await admin
    .from("product_prompt_settings")
    .select("prompt_name, label, is_hidden, admin_only, hide_in_documents, force_result, is_quantity")
    .eq("api_user_id", apiUserId)
    .eq("easyquote_product_id", productId);

  const norm = (v: any) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
  for (const s of (data as any[]) || []) {
    const keys = [s.prompt_name, s.label].filter(Boolean).map(norm);
    for (const k of keys) {
      settingsByKey.set(k, s);
      // Customer-facing portal: hide admin-only and explicitly hidden prompts.
      if (s.is_hidden || s.admin_only) hidden.add(k);
    }
  }
  return { hidden, settingsByKey };
}

export const normalizePromptKey = (v: any) =>
  String(v ?? "").replace(/\$/g, "").trim().toUpperCase();