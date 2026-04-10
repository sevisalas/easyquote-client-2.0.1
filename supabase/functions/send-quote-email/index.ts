import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    const pdfButton = pdfUrl
      ? `<p><a href="${pdfUrl}" style="display: inline-block; background-color: #c83077; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Descargar presupuesto PDF</a></p>`
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
        .replace(/\{\{boton_pdf\}\}/g, pdfButton)
        .replace(/\{\{empresa\}\}/g, fromName);

    let emailSubject: string;
    let htmlBody: string;

    if (subject) {
      // If caller provides explicit subject/body, use them (backwards compat)
      emailSubject = subject;
      htmlBody = body || buildDefaultHtml(quote, clientName, priceFormatted, pdfUrl, fromName);
    } else if (emailTemplate?.subject && emailTemplate?.body) {
      // Use custom template from DB
      emailSubject = replaceVars(emailTemplate.subject);
      htmlBody = replaceVars(emailTemplate.body);
    } else {
      // Fallback: default hardcoded template
      emailSubject = `Presupuesto ${quote.quote_number}`;
      htmlBody = buildDefaultHtml(quote, clientName, priceFormatted, pdfUrl, fromName);
    }

    // Send via SMTP
    const client = new SMTPClient({
      connection: {
        hostname: smtp.smtp_host,
        port: smtp.smtp_port,
        tls: smtp.use_tls,
        auth: {
          username: smtp.smtp_username,
          password: smtp.smtp_password_encrypted,
        },
      },
    });

    await client.send({
      from: `${fromName} <${smtp.from_email}>`,
      to: recipientEmail,
      subject: emailSubject,
      content: "auto",
      html: htmlBody,
    });

    await client.close();

    console.log(`Email sent to ${recipientEmail} for quote ${quote.quote_number}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado correctamente" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error al enviar el email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildDefaultHtml(
  quote: { quote_number: string; final_price: number | null },
  clientName: string,
  priceFormatted: string,
  pdfUrl: string | undefined,
  fromName: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Presupuesto ${quote.quote_number}</h2>
      <p>Estimado/a ${clientName},</p>
      <p>Adjunto encontrará el presupuesto <strong>${quote.quote_number}</strong>${priceFormatted ? ` por un importe de <strong>${priceFormatted}</strong>` : ""}.</p>
      ${pdfUrl ? `<p><a href="${pdfUrl}" style="display: inline-block; background-color: #c83077; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Descargar presupuesto PDF</a></p>` : ""}
      <p>Quedamos a su disposición para cualquier consulta.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #999;">Enviado desde ${fromName}</p>
    </div>
  `;
}
