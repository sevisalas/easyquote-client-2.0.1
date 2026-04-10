import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SmtpSettings {
  id: string;
  organization_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password_encrypted: string;
  from_email: string;
  from_name: string | null;
  use_tls: boolean;
  is_active: boolean;
}

type SmtpSettingsValues = Omit<SmtpSettings, "id" | "organization_id">;

const normalizeSmtpSettingsValues = (values: SmtpSettingsValues): SmtpSettingsValues => {
  const smtp_host = values.smtp_host.trim();
  const smtp_username = values.smtp_username.trim();
  const smtp_password_encrypted = values.smtp_password_encrypted.trim();
  const from_email = values.from_email.trim();
  const from_name = values.from_name?.trim() || null;
  const isConfigured = Boolean(smtp_host && smtp_username && smtp_password_encrypted && from_email);

  return {
    ...values,
    smtp_host,
    smtp_username,
    smtp_password_encrypted,
    from_email,
    from_name,
    is_active: isConfigured ? values.is_active : false,
  };
};

const normalizeStoredSmtpSettings = (settings: SmtpSettings | null): SmtpSettings | null => {
  if (!settings) return null;

  const normalizedValues = normalizeSmtpSettingsValues({
    smtp_host: settings.smtp_host,
    smtp_port: settings.smtp_port,
    smtp_username: settings.smtp_username,
    smtp_password_encrypted: settings.smtp_password_encrypted,
    from_email: settings.from_email,
    from_name: settings.from_name,
    use_tls: settings.use_tls,
    is_active: settings.is_active,
  });

  return {
    ...settings,
    ...normalizedValues,
  };
};

export function useSmtpSettings() {
  const queryClient = useQueryClient();
  const orgId = sessionStorage.getItem("selected_organization_id");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["smtp-settings", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("organization_smtp_settings" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return normalizeStoredSmtpSettings(data as unknown as SmtpSettings | null);
    },
    enabled: !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SmtpSettingsValues) => {
      if (!orgId) throw new Error("No hay organización seleccionada");

      const normalizedValues = normalizeSmtpSettingsValues(values);

      if (settings?.id) {
        const { error } = await supabase
          .from("organization_smtp_settings" as any)
          .update(normalizedValues as any)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_smtp_settings" as any)
          .insert({ ...normalizedValues, organization_id: orgId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuración SMTP guardada");
      queryClient.invalidateQueries({ queryKey: ["smtp-settings", orgId] });
    },
    onError: (error: any) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  return { settings, isLoading, saveMutation };
}
