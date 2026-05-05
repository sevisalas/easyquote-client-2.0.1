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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { customerId } = await req.json();
    if (!customerId) {
      return new Response(JSON.stringify({ error: "customerId obligatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Load customer + verify caller belongs to org
    const { data: customer, error: cErr } = await admin
      .from("customers")
      .select("id, name, trade_name, email, portal_enabled, portal_user_id, organization_id, user_id")
      .eq("id", customerId)
      .maybeSingle();
    if (cErr || !customer) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!customer.portal_enabled) {
      return new Response(JSON.stringify({ error: "El acceso al portal no está activado para este cliente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!customer.email || !customer.email.trim()) {
      return new Response(JSON.stringify({ error: "El cliente no tiene email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is org member or owner or superadmin
    const { data: isMember } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", customer.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: org } = await admin
      .from("organizations")
      .select("id, name, api_user_id, client_portal")
      .eq("id", customer.organization_id)
      .single();
    const isOwner = org?.api_user_id === user.id;
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "superadmin").maybeSingle();
    const isSuper = !!roleRow;
    if (!isMember && !isOwner && !isSuper) {
      return new Response(JSON.stringify({ error: "Sin permiso sobre este cliente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!org?.client_portal) {
      return new Response(JSON.stringify({ error: "El portal del cliente no está habilitado para esta organización" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = customer.email.trim().toLowerCase();
    const appUrl = "https://app.easyquote.cloud";
    const redirectTo = `${appUrl}/portal/set-password`;

    // Find or create the auth user
    let portalUserId = customer.portal_user_id as string | null;
    let isNew = false;
    if (!portalUserId) {
      // Try to find existing auth user with this email
      const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = existingList?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
      if (existing) {
        portalUserId = existing.id;
      } else {
        const { data: created, error: cuErr } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            portal_client: true,
            customer_id: customer.id,
            organization_id: customer.organization_id,
            display_name: customer.trade_name || customer.name,
          },
        });
        if (cuErr || !created?.user) {
          return new Response(JSON.stringify({ error: cuErr?.message || "No se pudo crear el usuario" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        portalUserId = created.user.id;
        isNew = true;
      }
      // Link
      await admin.from("customers").update({
        portal_user_id: portalUserId,
        portal_invited_at: new Date().toISOString(),
      }).eq("id", customer.id);
    } else {
      await admin.from("customers").update({
        portal_invited_at: new Date().toISOString(),
      }).eq("id", customer.id);
    }

    // Generate a recovery link (works for both new and existing users to set/reset password)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkErr?.message || "No se pudo generar el enlace" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const actionLink = linkData.properties.action_link;

    // Send email via tenant SMTP
    const { data: smtp } = await admin
      .from("organization_smtp_settings")
      .select("*")
      .eq("organization_id", customer.organization_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!smtp) {
      return new Response(JSON.stringify({
        error: "No hay SMTP configurado para esta organización",
        action_link: actionLink,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: theme } = await admin
      .from("organization_themes")
      .select("primary_color, logo_url")
      .eq("organization_id", customer.organization_id)
      .eq("is_active", true)
      .maybeSingle();
    const primary = theme?.primary_color || "#1B1B3A";
    const fromName = smtp.from_name || org?.name || "Portal";
    const portalLogin = `${appUrl}/portal/login`;
    const customerName = customer.trade_name || customer.name || "";

    const subject = isNew
      ? `Acceso al portal de ${org?.name || fromName}`
      : `Restablece tu acceso al portal de ${org?.name || fromName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color:#222;">
        <h2 style="color:${primary}; margin:0 0 16px;">Bienvenido al portal de clientes</h2>
        <p>Hola ${customerName ? customerName : ""},</p>
        <p>${org?.name || fromName} te ha habilitado el acceso al portal donde podrás consultar todos tus presupuestos.</p>
        <p>Para empezar, ${isNew ? "fija una contraseña" : "restablece tu contraseña"} pulsando el siguiente botón:</p>
        <p style="margin: 28px 0;">
          <a href="${actionLink}"
             style="background:${primary}; color:#fff; text-decoration:none; padding:12px 22px; border-radius:6px; display:inline-block; font-weight:bold;">
            ${isNew ? "Crear contraseña" : "Restablecer contraseña"}
          </a>
        </p>
        <p>Después podrás entrar siempre desde:<br/>
          <a href="${portalLogin}" style="color:${primary};">${portalLogin}</a><br/>
          con tu email <strong>${email}</strong>.
        </p>
        <hr style="border:none; border-top:1px solid #eee; margin:28px 0;" />
        <p style="font-size:12px; color:#888;">Si no esperabas este email puedes ignorarlo.</p>
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
      to: email,
      subject,
      html,
    });

    return new Response(JSON.stringify({ success: true, isNew }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("portal-customer-invite error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Error interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});