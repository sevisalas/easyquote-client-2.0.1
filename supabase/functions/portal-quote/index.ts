import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import nodemailer from "npm:nodemailer@6.9.14";

async function notifyTenantOfPortalAction(
  supabase: any,
  quoteId: string,
  action: "approved" | "rejected",
  comment: string | null,
  clientIp: string,
) {
  try {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, quote_number, organization_id, user_id, customer_id, final_price")
      .eq("id", quoteId)
      .single();
    if (!quote) return;

    // Recipient = quote sender (created_by / user_id)
    let recipientEmail: string | null = null;
    if (quote.user_id) {
      const { data: userRes } = await supabase.auth.admin.getUserById(quote.user_id);
      recipientEmail = userRes?.user?.email ?? null;
    }
    if (!recipientEmail) {
      console.log("notifyTenant: no recipient email, skipping");
      return;
    }

    const { data: smtp } = await supabase
      .from("organization_smtp_settings")
      .select("*")
      .eq("organization_id", quote.organization_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!smtp) {
      console.log("notifyTenant: no SMTP configured, skipping");
      return;
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", quote.organization_id)
      .single();

    let customerName = "";
    if (quote.customer_id) {
      const { data: c } = await supabase
        .from("customers")
        .select("name, trade_name")
        .eq("id", quote.customer_id)
        .maybeSingle();
      customerName = c?.trade_name || c?.name || "";
    }

    const isApproved = action === "approved";
    const emoji = isApproved ? "✅" : "❌";
    const actionLabel = isApproved ? "aprobado" : "rechazado";
    const subject = `${emoji} Presupuesto ${quote.quote_number} ${actionLabel} por el cliente`;
    const priceText = quote.final_price
      ? Number(quote.final_price).toLocaleString("es-ES", { style: "currency", currency: "EUR" })
      : "—";
    const when = new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
    const fromName = smtp.from_name || org?.name || "EasyQuote";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color:#333;">${emoji} Presupuesto ${actionLabel} desde el portal del cliente</h2>
        <p>El cliente <strong>${customerName || "(sin nombre)"}</strong> ha <strong>${actionLabel}</strong> el presupuesto <strong>${quote.quote_number}</strong> directamente desde el portal del cliente.</p>
        <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:4px 12px;color:#666;">Presupuesto</td><td style="padding:4px 12px;"><strong>${quote.quote_number}</strong></td></tr>
          <tr><td style="padding:4px 12px;color:#666;">Cliente</td><td style="padding:4px 12px;">${customerName || "—"}</td></tr>
          <tr><td style="padding:4px 12px;color:#666;">Importe</td><td style="padding:4px 12px;">${priceText}</td></tr>
          <tr><td style="padding:4px 12px;color:#666;">Fecha</td><td style="padding:4px 12px;">${when}</td></tr>
          <tr><td style="padding:4px 12px;color:#666;">IP cliente</td><td style="padding:4px 12px;">${clientIp}</td></tr>
        </table>
        ${comment ? `<p><strong>Comentario del cliente:</strong></p><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${comment.replace(/</g, "&lt;")}</blockquote>` : ""}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:12px;color:#999;">Notificación automática enviada desde ${fromName}. La acción fue realizada por el cliente desde el enlace público del portal.</p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: smtp.smtp_port,
      secure: smtp.smtp_port === 465,
      auth: { user: smtp.smtp_username, pass: smtp.smtp_password_encrypted },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `${fromName} <${smtp.from_email}>`,
      to: recipientEmail,
      subject,
      html,
    });
    console.log(`notifyTenant: sent ${action} notification to ${recipientEmail} for ${quote.quote_number}`);
  } catch (err) {
    console.error("notifyTenant error (non-blocking):", err);
  }
}

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
          organization_id, customer_id,
          items:quote_items(id, product_name, description, description_manual, quantity, price, prompts, outputs, multi, item_additionals, product_id),
          quote_additionals:quote_additionals(id, name, value, is_discount)
        `)
        .eq("id", tokenData.quote_id)
        .single();

      if (quoteError || !quote) {
        console.error("portal-quote: quote fetch error", quoteError);
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
            validity_days: null,
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
      const { action, comment, selectedItemIds, itemQuantities } = await req.json();

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
        // For approval, delegate to approve-quote (creates sales order, applies multi-qty selection, etc.)
        if (action === "approved") {
          try {
            const { error: approveErr } = await supabase.functions.invoke("approve-quote", {
              body: {
                quoteId: tokenData.quote_id,
                selectedItemIds: Array.isArray(selectedItemIds) && selectedItemIds.length > 0 ? selectedItemIds : undefined,
                itemQuantities: itemQuantities && typeof itemQuantities === "object" ? itemQuantities : undefined,
              },
            });
            if (approveErr) {
              console.error("portal-quote: approve-quote invoke error", approveErr);
              throw new Error("No se pudo crear el pedido. Contacta con el remitente.");
            }
          } catch (e: any) {
            // Roll back the action insert so the client can retry
            await supabase.from("quote_portal_actions")
              .delete()
              .eq("token_id", tokenData.id)
              .eq("action", action);
            return new Response(
              JSON.stringify({ error: e.message || "Error al aprobar" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          await supabase
            .from("quotes")
            .update({ status: action })
            .eq("id", tokenData.quote_id);
        }

        // Deactivate token after final action
        await supabase
          .from("quote_portal_tokens")
          .update({ is_active: false })
          .eq("id", tokenData.id);

        // Notify tenant (sender) by email — non-blocking
        await notifyTenantOfPortalAction(
          supabase,
          tokenData.quote_id,
          action,
          comment || null,
          clientIp,
        );
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
