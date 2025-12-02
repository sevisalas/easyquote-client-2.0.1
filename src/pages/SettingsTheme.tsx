import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function SettingsTheme() {
  const { userVariant, updateUserVariant, loading } = useTheme();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Tema - EasyQuote";
  }, []);

  const handleSaveVariant = async (variant: 'light' | 'dark' | 'system') => {
    setSaving(true);
    try {
      await updateUserVariant(variant);
      toast.success("Preferencia de tema guardada");
    } catch (error) {
      console.error('Error saving variant:', error);
      toast.error("Error al guardar tu preferencia");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Modo de Visualización</h1>
        <p className="text-muted-foreground mt-2">
          Elige tu preferencia de modo claro u oscuro
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preferencia de Tema</CardTitle>
          <CardDescription>
            Los colores corporativos se aplican automáticamente según tu organización
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card
              className={`cursor-pointer transition-all hover:shadow-lg ${
                userVariant === 'light' ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => handleSaveVariant('light')}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  Modo Claro
                  {userVariant === 'light' && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-24 rounded-md bg-background border flex items-center justify-center">
                  <p className="text-sm text-foreground">Vista previa clara</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-lg ${
                userVariant === 'dark' ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => handleSaveVariant('dark')}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  Modo Oscuro
                  {userVariant === 'dark' && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-24 rounded-md bg-slate-900 border flex items-center justify-center">
                  <p className="text-sm text-slate-100">Vista previa oscura</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:shadow-lg ${
                userVariant === 'system' ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => handleSaveVariant('system')}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  Automático
                  {userVariant === 'system' && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-24 rounded-md bg-gradient-to-r from-background to-slate-900 border flex items-center justify-center">
                  <p className="text-sm">Según sistema</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Modo Claro:</strong> Interfaz con fondos claros</p>
            <p>• <strong>Modo Oscuro:</strong> Interfaz con fondos oscuros</p>
            <p>• <strong>Automático:</strong> Sigue la preferencia de tu sistema operativo</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
