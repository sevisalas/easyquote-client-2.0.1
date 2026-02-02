import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// NOTE: Supabase Edge Runtime doesn't have a Node node_modules directory.
// Use esm.sh to load the npm package in a Deno-friendly way.
import { Resend } from "https://esm.sh/resend@2.0.0";

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: NotificationRequest = await req.json();
    
    if (data.type === 'new_request') {
      // Notify superadmin about new request
      const emailResponse = await resend.emails.send({
        from: "EasyQuote <support@easyquote.cloud>",
        to: ["support@easyquote.cloud"],
        subject: `${typeLabels[data.requestType]}: ${data.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Nueva solicitud de soporte</h2>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Tipo:</strong> ${typeLabels[data.requestType]}</p>
              <p><strong>Título:</strong> ${data.title}</p>
              <p><strong>Descripción:</strong></p>
              <p style="white-space: pre-wrap;">${data.description || 'Sin descripción'}</p>
              ${data.userEmail ? `<p><strong>Usuario:</strong> ${data.userEmail}</p>` : ''}
            </div>
            <p style="color: #6b7280; font-size: 12px;">
              Accede al panel de administración para gestionar esta solicitud.
            </p>
          </div>
        `,
      });

      console.log("New request notification sent:", emailResponse);
      
    } else if (data.type === 'status_update' && data.userEmail) {
      // Notify user about status update
      const emailResponse = await resend.emails.send({
        from: "EasyQuote <support@easyquote.cloud>",
        to: [data.userEmail],
        subject: `Actualización de tu solicitud: ${data.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Tu solicitud ha sido actualizada</h2>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Solicitud:</strong> ${data.title}</p>
              <p><strong>Nuevo estado:</strong> ${statusLabels[data.status || 'pending']}</p>
              ${data.adminNotes ? `
                <div style="margin-top: 16px; padding: 12px; background: #fff; border-left: 4px solid #3b82f6;">
                  <p><strong>Respuesta del equipo:</strong></p>
                  <p style="white-space: pre-wrap;">${data.adminNotes}</p>
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
