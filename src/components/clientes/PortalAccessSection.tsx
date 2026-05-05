import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePortalAccess } from "@/hooks/usePortalAccess";

interface PortalAccessSectionProps {
  customerId: string;
  customerEmail: string;
}

interface PortalState {
  portal_enabled: boolean;
  portal_enabled_at: string | null;
}

export const PortalAccessSection = ({ customerId, customerEmail }: PortalAccessSectionProps) => {
  const { hasPortalAccess, loading: loadingAccess } = usePortalAccess();
  const [state, setState] = useState<PortalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("portal_enabled, portal_enabled_at")
        .eq("id", customerId)
        .maybeSingle();
      if (!cancelled) {
        if (error) {
          console.error("[PortalAccessSection] load error", error);
        } else if (data) {
          setState({
            portal_enabled: (data as any).portal_enabled ?? false,
            portal_enabled_at: (data as any).portal_enabled_at ?? null,
          });
        }
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loadingAccess || !hasPortalAccess) return null;

  const hasEmail = !!customerEmail.trim();
  const enabled = state?.portal_enabled === true;

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        portal_enabled: next,
        portal_enabled_at: next ? new Date().toISOString() : null,
        portal_enabled_by: next ? user?.id ?? null : null,
      };
      const { error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", customerId);
      if (error) throw error;
      setState({
        portal_enabled: next,
        portal_enabled_at: payload.portal_enabled_at,
      });
      toast({
        title: next ? "Acceso activado" : "Acceso revocado",
        description: next
          ? "El cliente ya tiene marcado el acceso al portal."
          : "El acceso al portal del cliente ha sido revocado.",
      });
    } catch (e: any) {
      console.error("[PortalAccessSection] toggle error", e);
      toast({
        title: "Error",
        description: "No se pudo actualizar el acceso al portal.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Portal del cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando estado...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {enabled ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Acceso activo</Badge>
              ) : (
                <Badge variant="secondary">Sin acceso</Badge>
              )}
              {enabled && state?.portal_enabled_at && (
                <span className="text-xs text-muted-foreground">
                  desde {new Date(state.portal_enabled_at).toLocaleDateString()}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Marca si este cliente puede acceder al portal para consultar sus presupuestos.
              {!hasEmail && " Añade un email al cliente para poder activarlo."}
            </p>

            <div className="flex gap-2">
              {enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toggle(false)}
                  disabled={saving}
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  {saving ? "Revocando..." : "Revocar acceso"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => toggle(true)}
                  disabled={saving || !hasEmail}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {saving ? "Activando..." : "Activar acceso al portal"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PortalAccessSection;