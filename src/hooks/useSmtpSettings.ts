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
      return data as unknown as SmtpSettings | null;
    },
    enabled: !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Omit<SmtpSettings, "id" | "organization_id">) => {
      if (!orgId) throw new Error("No hay organización seleccionada");

      if (settings?.id) {
        const { error } = await supabase
          .from("organization_smtp_settings" as any)
          .update(values as any)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_smtp_settings" as any)
          .insert({ ...values, organization_id: orgId } as any);
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
