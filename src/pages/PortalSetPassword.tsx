import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { portalSupabase } from "./PortalLogin";

const PortalSetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Recovery flow: Supabase sets a temporary session via URL hash
    const sub = portalSupabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    portalSupabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Contraseña demasiado corta", description: "Mínimo 8 caracteres", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await portalSupabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Contraseña guardada", description: "Ya puedes acceder al portal." });
    navigate("/portal", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crea tu contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Validando enlace...
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Nueva contraseña</Label>
                <Input id="pw" type="password" required minLength={8}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf">Repite la contraseña</Label>
                <Input id="cf" type="password" required minLength={8}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar contraseña
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalSetPassword;