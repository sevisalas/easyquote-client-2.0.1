import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useIntegrationAccess } from "@/hooks/useIntegrationAccess";

export default function Integrations() {
  const { hasIntegrationAccess, loading } = useIntegrationAccess();
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa la API key",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Aquí se guardaría la API key
      toast({
        title: "Éxito",
        description: "API key guardada correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la API key",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has access to integrations
  if (!hasIntegrationAccess) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Acceso restringido</h2>
            <p className="text-muted-foreground">
              No tienes acceso al módulo de integraciones. Contacta a tu administrador para obtener acceso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Configurar Integración Holded</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>API Key de Holded</CardTitle>
            <CardDescription>
              Ingresa tu API key para conectar con Holded
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apikey">API Key</Label>
              <Input
                id="apikey"
                type="password"
                placeholder="Ingresa tu API key de Holded"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleSaveApiKey}
              disabled={saving}
              className="w-full"
            >
              {saving ? "Guardando..." : "Guardar API Key"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}