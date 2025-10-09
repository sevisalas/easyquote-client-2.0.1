import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Loader2, Save, Trash2 } from "lucide-react";

export default function HoldedConfig() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    fetchCurrentConfig();
  }, [currentOrganization?.id]);

  const fetchCurrentConfig = async () => {
    if (!currentOrganization?.id) {
      setFetching(false);
      return;
    }

    try {
      // Get Holded integration ID
      const { data: integration } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'Holded')
        .maybeSingle();

      if (!integration) {
        setFetching(false);
        return;
      }

      // Get current access token
      const { data: access } = await supabase
        .from('organization_integration_access')
        .select('access_token')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_id', integration.id)
        .maybeSingle();

      if (access?.access_token) {
        setApiKey(access.access_token);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setFetching(false);
    }
  };

  const saveApiKey = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se encontró la organización",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa una API key",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-holded-api-key', {
        body: { 
          organizationId: currentOrganization.id,
          apiKey: apiKey.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "API key de Holded guardada correctamente",
      });
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la API key",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeApiKey = async () => {
    if (!currentOrganization?.id) return;

    const confirmed = window.confirm("¿Estás seguro de que quieres eliminar la configuración de Holded?");
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('disable-holded-integration', {
        body: { organizationId: currentOrganization.id }
      });

      if (error) throw error;

      setApiKey("");
      toast({
        title: "Éxito",
        description: "Configuración de Holded eliminada",
      });
    } catch (error) {
      console.error('Error removing config:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la configuración",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Configuración de Holded</h1>
        <p className="text-muted-foreground">Conecta tu cuenta de Holded para importar clientes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Key de Holded</CardTitle>
          <CardDescription>
            Ingresa tu API key de Holded para habilitar la integración. Puedes obtenerla desde tu panel de Holded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Ingresa tu API key de Holded"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={saveApiKey} 
              disabled={loading || !apiKey.trim()}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </Button>

            {apiKey && (
              <Button 
                onClick={removeApiKey} 
                disabled={loading}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
