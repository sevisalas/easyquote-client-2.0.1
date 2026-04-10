import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSmtpSettings } from "@/hooks/useSmtpSettings";
import { Mail, Save, Eye, EyeOff } from "lucide-react";
import EmailTemplateCard from "@/components/settings/EmailTemplateCard";
import { toast } from "sonner";

export default function SettingsSmtp() {
  const { settings, isLoading, saveMutation } = useSmtpSettings();
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password_encrypted: "",
    from_email: "",
    from_name: "",
    use_tls: true,
    is_active: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        smtp_host: settings.smtp_host || "",
        smtp_port: settings.smtp_port || 587,
        smtp_username: settings.smtp_username || "",
        smtp_password_encrypted: settings.smtp_password_encrypted || "",
        from_email: settings.from_email || "",
        from_name: settings.from_name || "",
        use_tls: settings.use_tls ?? true,
        is_active: settings.is_active ?? false,
      });
    }
  }, [settings]);

  useEffect(() => {
    document.title = "Configuración SMTP | EasyQuote";
  }, []);

  const isConfigured =
    !!form.smtp_host.trim() &&
    !!form.smtp_username.trim() &&
    !!form.smtp_password_encrypted.trim() &&
    !!form.from_email.trim();

  const handleSave = () => {
    if (!isConfigured && form.is_active) {
      toast.error("No se puede activar el envío sin completar la configuración SMTP");
      return;
    }

    saveMutation.mutate({
      ...form,
      smtp_host: form.smtp_host.trim(),
      smtp_username: form.smtp_username.trim(),
      smtp_password_encrypted: form.smtp_password_encrypted.trim(),
      from_email: form.from_email.trim(),
      from_name: form.from_name.trim(),
      is_active: isConfigured ? form.is_active : false,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 max-w-2xl">
        <Card><CardContent className="p-6">Cargando...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración SMTP</h1>
          <p className="text-sm text-muted-foreground">
            Configura el servidor de correo para enviar presupuestos por email
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servidor SMTP</CardTitle>
          <CardDescription>Los datos de conexión a tu servidor de correo saliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Host SMTP *</Label>
              <Input
                placeholder="smtp.tuempresa.com"
                value={form.smtp_host}
                onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Puerto *</Label>
              <Input
                type="number"
                placeholder="587"
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Usuario SMTP *</Label>
              <Input
                placeholder="usuario@tuempresa.com"
                value={form.smtp_username}
                onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña SMTP *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.smtp_password_encrypted}
                  onChange={(e) => setForm({ ...form, smtp_password_encrypted: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.use_tls}
              onCheckedChange={(checked) => setForm({ ...form, use_tls: checked })}
            />
            <Label>Usar TLS/SSL</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remitente</CardTitle>
          <CardDescription>Datos que aparecerán como remitente en los emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email remitente *</Label>
              <Input
                type="email"
                placeholder="presupuestos@tuempresa.com"
                value={form.from_email}
                onChange={(e) => setForm({ ...form, from_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre remitente</Label>
              <Input
                placeholder="Mi Empresa"
                value={form.from_name || ""}
                onChange={(e) => setForm({ ...form, from_name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={isConfigured ? form.is_active : false}
                disabled={!isConfigured}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label>Envío de email activo</Label>
            </div>
            {!isConfigured && (
              <p className="text-sm text-muted-foreground">
                Si faltan datos SMTP obligatorios, el envío permanece desactivado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}
