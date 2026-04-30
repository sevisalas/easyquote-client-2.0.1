import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("quote_portal_tokens")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
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

    // GET: return quote data for portal view
    if (req.method === "GET") {
      // Update accessed_at
      await supabase
        .from("quote_portal_tokens")
        .update({ accessed_at: new Date().toISOString() })
        .eq("id", tokenData.id);

      // Log view action (only first time or if not viewed recently)
      const { data: existingView } = await supabase
        .from("quote_portal_actions")
        .select("id")
        .eq("token_id", tokenData.id)
        .eq("action", "viewed")
        .maybeSingle();

      if (!existingView) {
        const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
        await supabase.from("quote_portal_actions").insert({
          quote_id: tokenData.quote_id,
          token_id: tokenData.id,
          action: "viewed",
          client_ip: clientIp,
        });
      }

      // Get quote with items
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select(`
          id, quote_number, status, final_price, notes, created_at,
          organization_id, customer_id, validity_days,
          items:quote_items(id, product_name, description, quantity, price, prompts, outputs),
          quote_additionals:quote_additionals(id, name, value, is_discount)
        `)
        .eq("id", tokenData.quote_id)
        .single();

      if (quoteError || !quote) {
        return new Response(JSON.stringify({ error: "Presupuesto no encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get organization info (name, logo, theme)
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", quote.organization_id)
        .single();

      // Get theme
      const { data: theme } = await supabase
        .from("organization_themes")
        .select("primary_color, logo_url")
        .eq("organization_id", quote.organization_id)
        .eq("is_active", true)
        .maybeSingle();

      // Get customer name
      let customerName = "";
      if (quote.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("name, trade_name")
          .eq("id", quote.customer_id)
          .single();
        customerName = customer?.trade_name || customer?.name || "";
      }

      // Check if already acted upon
      const { data: existingAction } = await supabase
        .from("quote_portal_actions")
        .select("action, created_at, comment")
        .eq("token_id", tokenData.id)
        .in("action", ["approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          quote: {
            id: quote.id,
            quote_number: quote.quote_number,
            status: quote.status,
            final_price: quote.final_price,
            notes: quote.notes,
            created_at: quote.created_at,
            validity_days: quote.validity_days,
            items: quote.items,
            additionals: quote.quote_additionals,
          },
          organization: {
            name: org?.name || "",
            logo_url: theme?.logo_url || null,
            primary_color: theme?.primary_color || null,
          },
          customer_name: customerName,
          existing_action: existingAction || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: register client action
    if (req.method === "POST") {
      const { action, comment } = await req.json();

      if (!action || !["approved", "rejected", "commented"].includes(action)) {
        return new Response(JSON.stringify({ error: "Acción inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already approved/rejected
      const { data: existingAction } = await supabase
        .from("quote_portal_actions")
        .select("id, action")
        .eq("token_id", tokenData.id)
        .in("action", ["approved", "rejected"])
        .maybeSingle();

      if (existingAction) {
        return new Response(
          JSON.stringify({ error: "Ya se ha registrado una respuesta para este presupuesto" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

      // Insert action
      const { error: actionError } = await supabase.from("quote_portal_actions").insert({
        quote_id: tokenData.quote_id,
        token_id: tokenData.id,
        action,
        comment: comment || null,
        client_ip: clientIp,
      });

      if (actionError) throw actionError;

      // Update quote status if approved/rejected
      if (action === "approved" || action === "rejected") {
        await supabase
          .from("quotes")
          .update({ status: action })
          .eq("id", tokenData.quote_id);

        // Deactivate token after final action
        await supabase
          .from("quote_portal_tokens")
          .update({ is_active: false })
          .eq("id", tokenData.id);
      }

      return new Response(
        JSON.stringify({ success: true, message: action === "approved" ? "Presupuesto aprobado" : "Respuesta registrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Método no soportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Portal quote error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
