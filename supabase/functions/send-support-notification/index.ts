import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  type: 'new_request' | 'status_update';
  requestType: 'feature' | 'bug' | 'question';
  title: string;
  description?: string;
  status?: string;
  adminNotes?: string;
  userEmail?: string;
}

const typeLabels: Record<string, string> = {
  feature: '💡 Nueva funcionalidad',
  bug: '🐛 Reporte de error',
  question: '❓ Consulta',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
  rejected: 'Rechazado',
};

/** Escape HTML special characters to prevent injection */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication: require a valid JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data: NotificationRequest = await req.json();

    // Sanitize all user-provided fields
    const safeTitle = escapeHtml(data.title || '');
    const safeDescription = escapeHtml(data.description || 'Sin descripción');
    const safeAdminNotes = data.adminNotes ? escapeHtml(data.adminNotes) : '';
    const safeUserEmail = data.userEmail ? escapeHtml(data.userEmail) : '';
    
    if (data.type === 'new_request') {
      const emailResponse = await resend.emails.send({
        from: "EasyQuote <support@easyquote.cloud>",
        to: ["support@easyquote.cloud"],
        subject: `${typeLabels[data.requestType] || 'Solicitud'}: ${safeTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Nueva solicitud de soporte</h2>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Tipo:</strong> ${typeLabels[data.requestType] || 'Otro'}</p>
              <p><strong>Título:</strong> ${safeTitle}</p>
              <p><strong>Descripción:</strong></p>
              <p style="white-space: pre-wrap;">${safeDescription}</p>
              ${safeUserEmail ? `<p><strong>Usuario:</strong> ${safeUserEmail}</p>` : ''}
            </div>
            <p style="color: #6b7280; font-size: 12px;">
              Accede al panel de administración para gestionar esta solicitud.
            </p>
          </div>
        `,
      });

      console.log("New request notification sent:", emailResponse);
      
    } else if (data.type === 'status_update' && data.userEmail) {
      const emailResponse = await resend.emails.send({
        from: "EasyQuote <support@easyquote.cloud>",
        to: [data.userEmail],
        subject: `Actualización de tu solicitud: ${safeTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Tu solicitud ha sido actualizada</h2>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Solicitud:</strong> ${safeTitle}</p>
              <p><strong>Nuevo estado:</strong> ${statusLabels[data.status || 'pending'] || data.status}</p>
              ${safeAdminNotes ? `
                <div style="margin-top: 16px; padding: 12px; background: #fff; border-left: 4px solid #3b82f6;">
                  <p><strong>Respuesta del equipo:</strong></p>
                  <p style="white-space: pre-wrap;">${safeAdminNotes}</p>
                </div>
              ` : ''}
            </div>
            <p style="color: #6b7280; font-size: 12px;">
              Gracias por usar EasyQuote.
            </p>
          </div>
        `,
      });

      console.log("Status update notification sent:", emailResponse);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error sending notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
