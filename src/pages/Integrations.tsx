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
import { Download, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Integrations() {
  const { hasIntegrationAccess, loading } = useIntegrationAccess();
  const { isHoldedActive, loading: holdedLoading } = useHoldedIntegration();
  const { organization, membership } = useSubscription();
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const { toast } = useToast();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    if (isHoldedActive) {
      setShowConfig(false);
      loadContactsCount();
    }
  }, [isHoldedActive, currentOrganization]);

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

      toast({
        title: "Importación iniciada",
        description: data?.message || "Los contactos se están importando en segundo plano. Esto puede tardar unos momentos.",
      });

      // Reload contacts count after a delay to allow background task to complete
      setTimeout(() => {
        loadContactsCount();
      }, 5000);
    } catch (error: any) {
      console.error('Error importing Holded contacts:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron importar los contactos de Holded",
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
                    <p className="text-sm text-muted-foreground mb-4">
                      Importa todos los contactos desde Holded para poder buscarlos por nombre en los presupuestos.
                      Los contactos se guardan en una tabla separada y se actualizan con cada importación.
                    </p>
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
                    <p className="text-xs font-medium mb-2">Webhook de Zapier (para nuevos contactos)</p>
                    <code className="text-xs bg-background px-2 py-1 rounded block overflow-x-auto">
                      https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-zapier-webhook
                    </code>
                    <p className="text-xs text-muted-foreground mt-2">
                      Configura este webhook en Zapier para que los nuevos contactos se agreguen automáticamente.
                      Debe enviar: id, name, email, phone, mobile, organizationId
                    </p>
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