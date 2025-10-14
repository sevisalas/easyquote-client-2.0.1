import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useIntegrationAccess } from "@/hooks/useIntegrationAccess";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useWooCommerceIntegration } from "@/hooks/useWooCommerceIntegration";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { Download, Trash2, ShoppingCart } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Integrations() {
  const { hasIntegrationAccess, loading } = useIntegrationAccess();
  const { isHoldedActive, loading: holdedLoading, refreshIntegration: refreshHolded } = useHoldedIntegration();
  const { isWooCommerceActive, loading: wooLoading, refreshIntegration: refreshWoo } = useWooCommerceIntegration();
  const { organization, membership } = useSubscription();
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [togglingWoo, setTogglingWoo] = useState(false);
  const [organizationApiKey, setOrganizationApiKey] = useState<string | null>(null);
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    if (isHoldedActive) {
      setShowConfig(false);
      loadContactsCount();
    }
  }, [isHoldedActive, currentOrganization]);


  useEffect(() => {
    if (currentOrganization?.id) {
      loadOrganizationApiKey();
    }
  }, [currentOrganization]);

  const loadOrganizationApiKey = async () => {
    if (!currentOrganization?.id) return;
    
    setLoadingApiKey(true);
    try {
      const { data, error } = await supabase.rpc(
        'get_organization_api_credentials',
        { p_organization_id: currentOrganization.id }
      );

      if (error) throw error;
      
      if (data && data.length > 0) {
        setOrganizationApiKey(data[0].api_key);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    } finally {
      setLoadingApiKey(false);
    }
  };

  const handleGenerateApiKey = async () => {
    if (!currentOrganization?.id) return;
    
    setGeneratingApiKey(true);
    try {
      // Generate API key and secret using database functions
      const { data: keyData, error: keyError } = await supabase.rpc('generate_api_key');
      const { data: secretData, error: secretError } = await supabase.rpc('generate_api_secret');
      
      if (keyError || secretError) throw keyError || secretError;

      // Create credential using the database function
      const { data: credentialData, error: credError } = await supabase.rpc(
        'create_organization_api_credential',
        {
          p_organization_id: currentOrganization.id,
          p_api_key: keyData,
          p_api_secret: secretData
        }
      );

      if (credError) throw credError;

      setOrganizationApiKey(keyData);
      setShowApiKey(true);

      toast({
        title: "API Key generada",
        description: "Tu API Key ha sido generada correctamente",
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      toast({
        title: "Error",
        description: "No se pudo generar la API Key",
        variant: "destructive",
      });
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const copyApiKey = () => {
    if (organizationApiKey) {
      navigator.clipboard.writeText(organizationApiKey);
      toast({
        title: "Copiado",
        description: "API Key copiada al portapapeles",
      });
    }
  };


  const loadContactsCount = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { count, error } = await supabase
        .from('holded_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;
      setContactsCount(count || 0);
    } catch (error) {
      console.error('Error loading contacts count:', error);
    }
  };

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

  const handleToggleWooCommerce = async (enabled: boolean) => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se encontró la organización",
        variant: "destructive",
      });
      return;
    }

    // Validar que existe API Key antes de activar
    if (enabled && !organizationApiKey) {
      toast({
        title: "API Key requerida",
        description: "Debes generar una API Key antes de activar la integración",
        variant: "destructive",
      });
      return;
    }

    setTogglingWoo(true);
    try {

      const { data: integrationData, error: integrationError } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'WooCommerce')
        .single();

      if (integrationError) throw integrationError;

      if (enabled) {
        // Activate integration
        const { data: existingAccess } = await supabase
          .from('organization_integration_access')
          .select('id')
          .eq('organization_id', currentOrganization.id)
          .eq('integration_id', integrationData.id)
          .maybeSingle();

        if (existingAccess) {
          // Update to active
          const { error } = await supabase
            .from('organization_integration_access')
            .update({ is_active: true })
            .eq('organization_id', currentOrganization.id)
            .eq('integration_id', integrationData.id);

          if (error) throw error;
        } else {
          // Create new
          const { error } = await supabase
            .from('organization_integration_access')
            .insert({
              organization_id: currentOrganization.id,
              integration_id: integrationData.id,
              is_active: true
            });

          if (error) throw error;
        }

        toast({
          title: "Integración activada",
          description: "WooCommerce ha sido activado correctamente",
        });
      } else {
        // Deactivate integration
        const { error } = await supabase
          .from('organization_integration_access')
          .update({ is_active: false })
          .eq('organization_id', currentOrganization.id)
          .eq('integration_id', integrationData.id);

        if (error) throw error;

        toast({
          title: "Integración desactivada",
          description: "WooCommerce ha sido desactivado",
        });
      }
      
      refreshWoo();
    } catch (error) {
      console.error('Error toggling WooCommerce:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de la integración",
        variant: "destructive",
      });
    } finally {
      setTogglingWoo(false);
    }
  };


  const handleImportContacts = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se encontró la organización",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('holded-import-contacts', {
        body: { organizationId: currentOrganization.id }
      });

      if (error) throw error;

      // Show success message with details
      const imported = data?.imported || 0;
      const total = data?.total || 0;
      
      toast({
        title: "Importación completada",
        description: `${imported} contactos importados/actualizados de ${total} totales`,
      });

      // Reload contacts count
      loadContactsCount();
    } catch (error: any) {
      console.error('Error importing Holded contacts:', error);
      
      // Try to get more details from the error
      let errorMessage = "No se pudieron importar los contactos de Holded";
      
      if (error?.context?.body) {
        // Edge function returned an error with details
        errorMessage = error.context.body.error || errorMessage;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error de Holded",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteContacts = async () => {
    if (!currentOrganization?.id) return;

    const confirmed = window.confirm(
      `¿Estás seguro de que quieres eliminar TODOS los contactos de Holded importados (${contactsCount})? Esta acción no se puede deshacer.`
    );
    
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('holded_contacts')
        .delete()
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      toast({
        title: "Contactos eliminados",
        description: "Todos los contactos de Holded han sido eliminados correctamente",
      });

      setContactsCount(0);
    } catch (error: any) {
      console.error('Error deleting contacts:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los contactos",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || holdedLoading || wooLoading) {
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
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold mb-6">Integraciones</h1>
        
        {/* API Key Card */}
        <Card>
          <CardHeader>
            <CardTitle>API Key para WooCommerce</CardTitle>
            <CardDescription>
              Genera una API Key para sincronizar productos desde WordPress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingApiKey ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : organizationApiKey ? (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium">API Key</p>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? 'Ocultar' : 'Mostrar'}
                    </Button>
                  </div>
                  <code className="text-xs bg-background px-2 py-1 rounded block overflow-x-auto">
                    {showApiKey ? organizationApiKey : '••••••••••••••••••••••••••••'}
                  </code>
                  <Button 
                    size="sm"
                    variant="outline" 
                    className="mt-2 w-full"
                    onClick={copyApiKey}
                  >
                    📋 Copiar API Key
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={handleGenerateApiKey}
                disabled={generatingApiKey}
                className="w-full"
              >
                {generatingApiKey ? "Generando..." : "🔑 Generar API Key"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* WooCommerce Integration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span>WooCommerce</span>
              </div>
              <Switch
                checked={isWooCommerceActive}
                onCheckedChange={handleToggleWooCommerce}
                disabled={togglingWoo}
              />
            </CardTitle>
            <CardDescription>
              Activa la sincronización de productos con WooCommerce
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {isWooCommerceActive 
                ? '✓ Integración activa. Configura el plugin de WordPress con tu API Key para sincronizar productos.' 
                : organizationApiKey 
                  ? 'Activa el switch para habilitar la integración con WooCommerce.' 
                  : 'Genera primero una API Key antes de activar la integración.'}
            </p>
          </CardContent>
        </Card>

        {/* Holded Integration Card */}
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

            {showConfig && (
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
              <>
                <Button 
                  variant="outline"
                  onClick={() => setShowConfig(true)}
                  className="w-full"
                >
                  Actualizar API Key
                </Button>

                <Separator className="my-6" />

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Contactos de Holded</h3>
                    {contactsCount !== null && (
                      <p className="text-sm mb-4">
                        <span className="font-medium">Contactos importados:</span> {contactsCount}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleImportContacts} 
                      disabled={isImporting}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {isImporting ? "Importando..." : "Importar Contactos"}
                    </Button>

                    {contactsCount !== null && contactsCount > 0 && (
                      <Button 
                        variant="destructive"
                        onClick={handleDeleteContacts}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs font-medium mb-2">Webhook de Zapier</p>
                    <code className="text-xs bg-background px-2 py-1 rounded block overflow-x-auto">
                      https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-zapier-webhook
                    </code>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}