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
  const [wooEndpoint, setWooEndpoint] = useState("");
  const [editingWooEndpoint, setEditingWooEndpoint] = useState(false);
  const [savingWooEndpoint, setSavingWooEndpoint] = useState(false);
  const { toast } = useToast();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    if (isHoldedActive) {
      setShowConfig(false);
      loadContactsCount();
    }
  }, [isHoldedActive, currentOrganization]);

  useEffect(() => {
    if (isWooCommerceActive) {
      loadWooCommerceEndpoint();
    }
  }, [isWooCommerceActive, currentOrganization]);

  const loadWooCommerceEndpoint = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { data: integrationData } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'WooCommerce')
        .single();

      if (!integrationData) return;

      const { data: accessData } = await supabase
        .from('organization_integration_access')
        .select('configuration')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_id', integrationData.id)
        .single();

      const config = accessData?.configuration as { endpoint?: string } | null;
      if (config?.endpoint) {
        setWooEndpoint(config.endpoint);
      }
    } catch (error) {
      console.error('Error loading WooCommerce endpoint:', error);
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

  const handleSaveWooEndpoint = async () => {
    if (!wooEndpoint.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el endpoint de WooCommerce",
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

    setSavingWooEndpoint(true);
    try {
      const { data: integrationData } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'WooCommerce')
        .single();

      if (!integrationData) throw new Error('WooCommerce integration not found');

      const { error } = await supabase
        .from('organization_integration_access')
        .update({
          configuration: { endpoint: wooEndpoint.trim() }
        })
        .eq('organization_id', currentOrganization.id)
        .eq('integration_id', integrationData.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Endpoint guardado correctamente",
      });
      
      setEditingWooEndpoint(false);
    } catch (error) {
      console.error('Error saving WooCommerce endpoint:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el endpoint",
        variant: "destructive",
      });
    } finally {
      setSavingWooEndpoint(false);
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

    setTogglingWoo(true);
    try {
      // Get WooCommerce integration ID
      const { data: integrationData, error: integrationError } = await supabase
        .from('integrations')
        .select('id')
        .eq('name', 'WooCommerce')
        .single();

      if (integrationError) throw integrationError;

      if (enabled) {
        // Enable integration
        const { error: insertError } = await supabase
          .from('organization_integration_access')
          .insert({
            organization_id: currentOrganization.id,
            integration_id: integrationData.id,
            is_active: true,
            configuration: {}
          });

        if (insertError) throw insertError;

        toast({
          title: "Éxito",
          description: "Integración de WooCommerce activada. Configura el endpoint para comenzar.",
        });
      } else {
        // Disable integration
        const { error: deleteError } = await supabase
          .from('organization_integration_access')
          .delete()
          .eq('organization_id', currentOrganization.id)
          .eq('integration_id', integrationData.id);

        if (deleteError) throw deleteError;

        toast({
          title: "Éxito",
          description: "Integración de WooCommerce desactivada",
        });
        
        setWooEndpoint("");
      }

      refreshWoo();
    } catch (error) {
      console.error('Error toggling WooCommerce integration:', error);
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
        
        {/* WooCommerce Integration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span>WooCommerce</span>
              </div>
              <span className={`text-sm px-2 py-1 rounded ${
                isWooCommerceActive 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
              }`}>
                {isWooCommerceActive ? 'Activa' : 'Inactiva'}
              </span>
            </CardTitle>
            <CardDescription>
              Conecta con tu tienda WooCommerce para sincronizar productos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="woo-toggle">Habilitar integración</Label>
                <p className="text-sm text-muted-foreground">
                  Activa esta integración para ver qué productos están vinculados a WooCommerce
                </p>
              </div>
              <Switch
                id="woo-toggle"
                checked={isWooCommerceActive}
                onCheckedChange={handleToggleWooCommerce}
                disabled={togglingWoo}
              />
            </div>

            {isWooCommerceActive && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Configuración del Endpoint</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configura la URL del endpoint de tu tienda WooCommerce para sincronizar productos.
                    </p>
                  </div>

                  {!editingWooEndpoint && wooEndpoint ? (
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium">Endpoint configurado</p>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setEditingWooEndpoint(true)}
                        >
                          Editar
                        </Button>
                      </div>
                      <code className="text-xs bg-background px-2 py-1 rounded block overflow-x-auto">
                        {wooEndpoint}
                      </code>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="woo-endpoint">URL del Endpoint</Label>
                      <Input
                        id="woo-endpoint"
                        type="url"
                        placeholder="https://tutienda.com/wp-json/easyquote/v1/products-by-calculator/{calculator_id}"
                        value={wooEndpoint}
                        onChange={(e) => setWooEndpoint(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Usa {"{calculator_id}"} como placeholder para el ID del calculador
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleSaveWooEndpoint}
                          disabled={savingWooEndpoint}
                          className="flex-1"
                        >
                          {savingWooEndpoint ? "Guardando..." : "Guardar Endpoint"}
                        </Button>
                        {editingWooEndpoint && (
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setEditingWooEndpoint(false);
                              loadWooCommerceEndpoint();
                            }}
                            disabled={savingWooEndpoint}
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </>
            )}
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