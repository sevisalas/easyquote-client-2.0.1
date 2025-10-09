import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

export default function HoldedConfig() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { toast } = useToast();
  const { organization, membership } = useSubscription();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    fetchCurrentConfig();
  }, [currentOrganization?.id]);

  const fetchCurrentConfig = async () => {
    if (!currentOrganization?.id) return;

    setFetching(true);
    try {
      // Get Holded integration ID
      const { data: integration, error: integrationError } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'Holded')
        .maybeSingle();

      if (integrationError || !integration) {
        console.error('Error fetching Holded integration:', integrationError);
        return;
      }

      // Get current API key
      const { data: access, error: accessError } = await supabase
        .from('organization_integration_access')
        .select('access_token')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_id', integration.id)
        .maybeSingle();

      if (accessError) {
        console.error('Error fetching access token:', accessError);
        return;
      }

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
        description: "No hay organización seleccionada",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa una API Key",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('save-holded-api-key', {
        body: { 
          organizationId: currentOrganization.id,
          apiKey: apiKey.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "API Key guardada",
        description: "La configuración de Holded ha sido actualizada correctamente",
      });
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la API Key de Holded",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeApiKey = async () => {
    if (!currentOrganization?.id) return;

    if (!confirm('¿Estás seguro de que quieres eliminar la configuración de Holded?')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('disable-holded-integration', {
        body: { organizationId: currentOrganization.id }
      });

      if (error) throw error;

      setApiKey("");
      toast({
        title: "Configuración eliminada",
        description: "La integración con Holded ha sido desactivada",
      });
    } catch (error) {
      console.error('Error removing config:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la configuración de Holded",
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
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Holded</CardTitle>
          <CardDescription>
            Configura tu API Key de Holded para sincronizar tus datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              API Key de Holded
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Ingresa tu API Key de Holded"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveApiKey}
              disabled={loading || !apiKey.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Configuración
            </Button>
            {apiKey && (
              <Button
                variant="destructive"
                onClick={removeApiKey}
                disabled={loading}
              >
                Eliminar Configuración
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
