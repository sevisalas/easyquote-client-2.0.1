import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  organization_id: string;
  template_key: string;
  subject: string;
  body: string;
}

type EmailTemplateValues = Pick<EmailTemplate, "subject" | "body">;

const DEFAULT_SUBJECT = "Presupuesto {{numero}}";
const DEFAULT_BODY = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">Presupuesto {{numero}}</h2>
  <p>Estimado/a {{cliente}},</p>
  <p>Adjunto encontrará el presupuesto <strong>{{numero}}</strong>{{precio}}.</p>
  {{boton_pdf}}
  <p>Quedamos a su disposición para cualquier consulta.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="font-size: 12px; color: #999;">Enviado desde {{empresa}}</p>
</div>`;

export const EMAIL_TEMPLATE_VARIABLES = [
  { key: "{{numero}}", label: "Nº presupuesto" },
  { key: "{{cliente}}", label: "Nombre del cliente" },
  { key: "{{precio}}", label: "Precio formateado" },
  { key: "{{boton_pdf}}", label: "Botón descargar PDF" },
  { key: "{{empresa}}", label: "Nombre de la empresa" },
];

export function useEmailTemplates() {
  const queryClient = useQueryClient();
  const orgId = sessionStorage.getItem("selected_organization_id");

  const { data: template, isLoading } = useQuery({
    queryKey: ["email-template", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("email_templates" as any)
        .select("*")
        .eq("organization_id", orgId)
        .eq("template_key", "quote_sent")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EmailTemplate | null;
    },
    enabled: !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: EmailTemplateValues) => {
      if (!orgId) throw new Error("No hay organización seleccionada");

      if (template?.id) {
        const { error } = await supabase
          .from("email_templates" as any)
          .update({ subject: values.subject, body: values.body } as any)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates" as any)
          .insert({
            organization_id: orgId,
            template_key: "quote_sent",
            subject: values.subject,
            body: values.body,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Plantilla de email guardada");
      queryClient.invalidateQueries({ queryKey: ["email-template", orgId] });
    },
    onError: (error: any) => {
      toast.error(`Error al guardar plantilla: ${error.message}`);
    },
  });

  return {
    template,
    isLoading,
    saveMutation,
    defaultSubject: DEFAULT_SUBJECT,
    defaultBody: DEFAULT_BODY,
  };
}
