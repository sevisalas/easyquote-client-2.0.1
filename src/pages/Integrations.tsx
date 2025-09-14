import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useIntegrationAccess } from "@/hooks/useIntegrationAccess";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";

export default function Integrations() {
  const { hasIntegrationAccess, loading } = useIntegrationAccess();
  const { isHoldedActive, loading: holdedLoading } = useHoldedIntegration();
  const { organization, membership } = useSubscription();
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const { toast } = useToast();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    if (isHoldedActive) {
      setShowConfig(false);
    }
  }, [isHoldedActive]);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa la API key",
        variant: "destructive",
      });
      return;
    }

    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se encontró la organización",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-holded-api-key', {
        body: { 
          organizationId: currentOrganization.id, 
          apiKey: apiKey.trim() 
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Éxito",
        description: "API key guardada correctamente",
      });
      
      setApiKey("");
      setShowConfig(false);
      // Refresh integration status
      window.location.reload();
      
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la API key",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || holdedLoading) {
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
        <h1 className="text-2xl font-bold mb-6">Integración Holded</h1>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Holded</span>
              <span className={`text-sm px-2 py-1 rounded ${
                isHoldedActive 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
              }`}>
                {isHoldedActive ? 'Activa' : 'Inactiva'}
              </span>
            </CardTitle>
            <CardDescription>
              {isHoldedActive 
                ? 'Tu integración con Holded está activa y funcionando' 
                : 'Configura tu API key para conectar con Holded'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isHoldedActive && !showConfig && (
              <Button 
                onClick={() => setShowConfig(true)}
                className="w-full"
              >
                Configurar
              </Button>
            )}

            {(!isHoldedActive && showConfig) && (
              <>
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
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveApiKey}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? "Guardando..." : "Guardar API Key"}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowConfig(false);
                      setApiKey("");
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            )}

            {isHoldedActive && (
              <Button 
                variant="outline"
                onClick={() => setShowConfig(true)}
                className="w-full"
              >
                Actualizar API Key
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}