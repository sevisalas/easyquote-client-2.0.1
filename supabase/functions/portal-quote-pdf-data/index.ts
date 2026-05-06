import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const isCellRef = (v: string) => /^[A-Z]+\d+$/i.test(String(v ?? "").trim());
const normalize = (v: string) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || (await req.json().catch(() => ({})))?.token;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from("quote_portal_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Token inválido o expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este enlace ha expirado" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the quote with items + additionals
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`*, items:quote_items(*), quote_additionals:quote_additionals(*)`)
      .eq("id", tokenData.quote_id)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: "Presupuesto no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Customer
    let customer: any = null;
    if (quote.customer_id) {
      const { data: c } = await supabase
        .from("customers")
        .select("*")
        .eq("id", quote.customer_id)
        .maybeSingle();
      customer = c || null;
    }

    // PDF configuration (template, logo, color, footer, terms)
    const { data: pdfConfig } = await supabase
      .from("pdf_configurations")
      .select("*")
      .eq("organization_id", quote.organization_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const config = {
      selectedTemplate: pdfConfig?.selected_template || 1,
      companyName: pdfConfig?.company_name || "",
      logoUrl: pdfConfig?.logo_url || "",
      brandColor: pdfConfig?.brand_color || "#0ea5e9",
      footerText: pdfConfig?.footer_text || "",
      termsPageText: pdfConfig?.terms_page_text || "",
    };

    // Org-level flag: hide all prompts in documents
    const { data: orgFlags } = await supabase
      .from("organizations")
      .select("hide_all_prompts_in_documents, api_user_id")
      .eq("id", quote.organization_id)
      .single();
    const hideAllPromptsInDocs = orgFlags?.hide_all_prompts_in_documents === true;

    // Quantity prompt map (productId -> prompt_name)
    const quantityPromptMap: Record<string, string> = {};
    // Hidden prompt settings (productId -> [normalized keys])
    const hiddenPromptSettings: Record<string, string[]> = {};

    if (orgFlags?.api_user_id) {
      const { data: qtySettings } = await supabase
        .from("product_prompt_settings")
        .select("easyquote_product_id, prompt_name")
        .eq("api_user_id", orgFlags.api_user_id)
        .eq("is_quantity", true);
      (qtySettings || []).forEach((s: any) => {
        if (s.easyquote_product_id) quantityPromptMap[s.easyquote_product_id] = s.prompt_name;
      });

      const { data: hiddenSettings } = await supabase
        .from("product_prompt_settings")
        .select("easyquote_product_id, prompt_name, label")
        .eq("api_user_id", orgFlags.api_user_id)
        .or("hide_in_documents.eq.true,admin_only.eq.true");

      (hiddenSettings || []).forEach((s: any) => {
        if (!s.easyquote_product_id) return;
        if (!hiddenPromptSettings[s.easyquote_product_id]) {
          hiddenPromptSettings[s.easyquote_product_id] = [];
        }
        const arr = hiddenPromptSettings[s.easyquote_product_id];
        const k1 = normalize(s.prompt_name);
        if (k1 && !arr.includes(k1)) arr.push(k1);
        if (s.label && s.label !== s.prompt_name && !isCellRef(s.label)) {
          const k2 = normalize(s.label);
          if (k2 && !arr.includes(k2)) arr.push(k2);
        }
      });
    }

    return new Response(
      JSON.stringify({
        quote,
        customer,
        config,
        hideAllPromptsInDocs,
        hiddenPromptSettings,
        quantityPromptMap,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("portal-quote-pdf-data error:", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});