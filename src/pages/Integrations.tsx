import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Settings } from "lucide-react";

interface Integration {
  id?: string;
  integration_type: string;
  configuration: {
    apiKey?: string;
  };
  is_active: boolean;
}

const Integrations = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holdedConfig, setHoldedConfig] = useState<Integration>({
    integration_type: 'holded',
    configuration: { apiKey: '' },
    is_active: false
  });
  
  const { toast } = useToast();
  const { organization, membership, isSuperAdmin, isOrgAdmin } = useSubscription();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    if (!isOrgAdmin) return;
    loadIntegrations();
  }, [currentOrganization?.id, isOrgAdmin]);

  const loadIntegrations = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_type', 'holded')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading integrations:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las integraciones",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        const config = data.configuration as { apiKey?: string } || { apiKey: '' };
        setHoldedConfig({
          id: data.id,
          integration_type: data.integration_type,
          configuration: config,
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las integraciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveHoldedIntegration = async () => {
    if (!currentOrganization?.id) return;
    
    setSaving(true);
    try {
      const isActive = !!(holdedConfig.configuration.apiKey?.trim());
      const integrationData = {
        organization_id: currentOrganization.id,
        integration_type: 'holded',
        configuration: holdedConfig.configuration,
        is_active: isActive
      };

      if (holdedConfig.id) {
        const { error } = await supabase
          .from('integrations')
          .update(integrationData)
          .eq('id', holdedConfig.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('integrations')
          .insert(integrationData)
          .select()
          .single();

        if (error) throw error;
        setHoldedConfig(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "Éxito",
        description: "Configuración de Holded guardada correctamente",
      });
    } catch (error) {
      console.error('Error saving integration:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOrgAdmin) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Acceso Denegado</h1>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando integraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Integraciones</h1>
          <p className="text-muted-foreground">
            Configura las integraciones con servicios externos
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Integración con Holded */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Holded</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${holdedConfig.configuration.apiKey?.trim() ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-muted-foreground">
                  {holdedConfig.configuration.apiKey?.trim() ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </CardTitle>
            <CardDescription>
              Integración con Holded para sincronización de datos contables
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holded-key">API Key</Label>
              <Input
                id="holded-key"
                type="password"
                placeholder="Introduce tu API Key de Holded"
                value={holdedConfig.configuration.apiKey || ''}
                onChange={(e) =>
                  setHoldedConfig(prev => ({
                    ...prev,
                    configuration: { ...prev.configuration, apiKey: e.target.value }
                  }))
                }
              />
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={saveHoldedIntegration}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Integrations;