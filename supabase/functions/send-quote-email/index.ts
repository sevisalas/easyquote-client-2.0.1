import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import nodemailer from "npm:nodemailer@6.9.14";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quoteId, recipientEmail, recipientName, subject, body, pdfUrl } = await req.json();

    if (!quoteId || !recipientEmail) {
      return new Response(JSON.stringify({ error: "quoteId y recipientEmail son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get quote to find organization_id
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from("quotes")
      .select("organization_id, quote_number, final_price, customer_id")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: "Presupuesto no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if client portal is enabled for this org
    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("client_portal")
      .eq("id", quote.organization_id)
      .maybeSingle();

    const clientPortalEnabled = orgData?.client_portal === true;
    let portalUrl: string | undefined;

    if (clientPortalEnabled) {
      // Generate portal token
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("quote_portal_tokens")
        .insert({
          quote_id: quoteId,
        })
        .select("token")
        .single();

      if (!tokenError && tokenData) {
        // Use the app's published URL
        const appUrl = "https://easyquote-client.lovable.app";
        portalUrl = `${appUrl}/portal/${tokenData.token}`;
      }
    }

    // Verify user belongs to this org
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", quote.organization_id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No perteneces a esta organización" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SMTP settings for the organization
    const { data: smtp, error: smtpError } = await supabaseAdmin
      .from("organization_smtp_settings")
      .select("*")
      .eq("organization_id", quote.organization_id)
      .eq("is_active", true)
      .maybeSingle();

    if (smtpError || !smtp) {
      return new Response(
        JSON.stringify({ error: "No hay configuración SMTP activa para esta organización. Configúrala en Ajustes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org name for email
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", quote.organization_id)
      .single();

    const fromName = smtp.from_name || org?.name || "EasyQuote";

    // Get org theme for button color
    const { data: orgTheme } = await supabaseAdmin
      .from("organization_themes")
      .select("primary_color")
      .eq("organization_id", quote.organization_id)
      .eq("is_active", true)
      .maybeSingle();

    const buttonColor = orgTheme?.primary_color
      ? `hsl(${orgTheme.primary_color})`
      : "#c83077";

    // Get custom email template
    const { data: emailTemplate } = await supabaseAdmin
      .from("email_templates")
      .select("subject, body")
      .eq("organization_id", quote.organization_id)
      .eq("template_key", "quote_sent")
      .maybeSingle();

    // Build dynamic values
    const priceFormatted = quote.final_price
      ? Number(quote.final_price).toLocaleString("es-ES", { style: "currency", currency: "EUR" })
      : "";

    const portalButton = portalUrl
      ? `<p><a href="${portalUrl}" style="display: inline-block; background-color: ${buttonColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver y aprobar presupuesto</a></p>`
      : "";

    const pdfButton = pdfUrl
      ? portalUrl
        ? `<p><a href="${pdfUrl}" style="color: ${buttonColor}; text-decoration: underline; font-size: 14px;">Descargar PDF</a></p>`
        : `<p><a href="${pdfUrl}" style="display: inline-block; background-color: ${buttonColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Descargar presupuesto PDF</a></p>`
      : "";

    const priceText = priceFormatted
      ? ` por un importe de <strong>${priceFormatted}</strong>`
      : "";

    const clientName = recipientName || "cliente";

    // Replace variables in template
    const replaceVars = (text: string) =>
      text
        .replace(/\{\{numero\}\}/g, quote.quote_number || "")
        .replace(/\{\{cliente\}\}/g, clientName)
        .replace(/\{\{precio\}\}/g, priceText)
        .replace(/\{\{boton_portal\}\}/g, portalButton)
        .replace(/\{\{boton_pdf\}\}/g, pdfButton)
        .replace(/\{\{empresa\}\}/g, fromName);

    let emailSubject: string;
    let htmlBody: string;

    if (subject) {
      // If caller provides explicit subject/body, use them (backwards compat)
      emailSubject = subject;
      htmlBody = body || buildDefaultHtml(quote, clientName, priceFormatted, pdfUrl, portalUrl, fromName, buttonColor);
    } else if (emailTemplate?.subject && emailTemplate?.body) {
      // Use custom template from DB
      emailSubject = replaceVars(emailTemplate.subject);
      htmlBody = replaceVars(emailTemplate.body);
    } else {
      // Fallback: default hardcoded template
      emailSubject = `Presupuesto ${quote.quote_number}`;
      htmlBody = buildDefaultHtml(quote, clientName, priceFormatted, pdfUrl, portalUrl, fromName, buttonColor);
    }

    // Send via SMTP using nodemailer (more reliable than denomailer for STARTTLS on 587)
    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: smtp.smtp_port,
      secure: smtp.smtp_port === 465, // true for 465, false for 587 (STARTTLS)
      auth: {
        user: smtp.smtp_username,
        pass: smtp.smtp_password_encrypted,
      },
      tls: {
        // Tolerate self-signed / hostname mismatches commonly found on shared hosting
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
      from: `${fromName} <${smtp.from_email}>`,
      to: recipientEmail,
      subject: emailSubject,
      html: htmlBody,
    });

    console.log(`Email sent to ${recipientEmail} for quote ${quote.quote_number}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado correctamente" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    const message = error instanceof Error ? error.message : "Error al enviar el email";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildDefaultHtml(
  quote: { quote_number: string; final_price: number | null },
  clientName: string,
  priceFormatted: string,
  pdfUrl: string | undefined,
  portalUrl: string | undefined,
  fromName: string,
  buttonColor: string = "#c83077"
): string {
  const primaryCta = portalUrl
    ? `<p><a href="${portalUrl}" style="display: inline-block; background-color: ${buttonColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver y aprobar presupuesto</a></p>`
    : pdfUrl
      ? `<p><a href="${pdfUrl}" style="display: inline-block; background-color: ${buttonColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Descargar presupuesto PDF</a></p>`
      : "";

  const secondaryCta = portalUrl && pdfUrl
    ? `<p><a href="${pdfUrl}" style="color: ${buttonColor}; text-decoration: underline; font-size: 14px;">Descargar PDF</a></p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Presupuesto ${quote.quote_number}</h2>
      <p>Estimado/a ${clientName},</p>
      <p>Le enviamos el presupuesto <strong>${quote.quote_number}</strong>${priceFormatted ? ` por un importe de <strong>${priceFormatted}</strong>` : ""}.</p>
      ${primaryCta}
      ${secondaryCta}
      <p>Quedamos a su disposición para cualquier consulta.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #999;">Enviado desde ${fromName}</p>
    </div>
  `;
}
