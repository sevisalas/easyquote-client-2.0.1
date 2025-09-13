import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Key, Copy, RefreshCw, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ApiCredential {
  id: string;
  api_key: string;
  api_secret: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
  usage_count: number;
}

const OrganizationApiCredentials = () => {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    cargarCredenciales();
  }, []);

  const cargarCredenciales = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_api_credentials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading credentials:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las credenciales",
          variant: "destructive",
        });
      } else if (data) {
        setCredentials(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const generarCredenciales = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Obtener la organización del usuario
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('api_user_id', user.id)
        .single();

      if (orgError || !orgData) {
        throw new Error('No organization found');
      }

      // Generar las credenciales usando las funciones de la BD
      const { data: apiKey, error: keyError } = await supabase
        .rpc('generate_api_key');
      
      const { data: apiSecret, error: secretError } = await supabase
        .rpc('generate_api_secret');

      if (keyError || secretError) {
        throw new Error('Error generating credentials');
      }

      // Insertar las nuevas credenciales
      const { error: insertError } = await supabase
        .from('organization_api_credentials')
        .insert([{
          organization_id: orgData.id,
          api_key: apiKey,
          api_secret: apiSecret,
          created_by: user.id
        }]);

      if (insertError) throw insertError;

      toast({
        title: "Éxito",
        description: "Credenciales API generadas correctamente",
      });

      await cargarCredenciales();

    } catch (error: any) {
      console.error('Error generating credentials:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron generar las credenciales",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const eliminarCredencial = async (id: string) => {
    try {
      const { error } = await supabase
        .from('organization_api_credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Credencial eliminada correctamente",
      });

      await cargarCredenciales();
    } catch (error: any) {
      console.error('Error deleting credential:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la credencial",
        variant: "destructive",
      });
    }
  };

  const copiarAlPortapapeles = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado",
        description: `${type} copiado al portapapeles`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  };

  const toggleShowSecret = (credentialId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [credentialId]: !prev[credentialId]
    }));
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="flex flex-col items-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Credenciales API de la Organización</CardTitle>
            <CardDescription className="text-center">
              Gestiona las credenciales API principales de tu organización para integrar con EasyQuote
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Credenciales Activas</h3>
              <Button 
                onClick={generarCredenciales}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Generando..." : "Generar Nuevas Credenciales"}
              </Button>
            </div>

            {credentials.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No tienes credenciales API generadas
                </p>
                <Button onClick={generarCredenciales} disabled={loading}>
                  Generar Primera Credencial
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {credentials.map((credential) => (
                  <Card key={credential.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Creada: {new Date(credential.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Usos: {credential.usage_count}
                          </p>
                          {credential.last_used_at && (
                            <p className="text-sm text-muted-foreground">
                              Último uso: {new Date(credential.last_used_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            credential.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {credential.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar credencial?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. La credencial será eliminada permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => eliminarCredencial(credential.id)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`api-key-${credential.id}`}>API Key</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              id={`api-key-${credential.id}`}
                              value={credential.api_key}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copiarAlPortapapeles(credential.api_key, "API Key")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`api-secret-${credential.id}`}>API Secret</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              id={`api-secret-${credential.id}`}
                              type={showSecrets[credential.id] ? "text" : "password"}
                              value={credential.api_secret}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleShowSecret(credential.id)}
                            >
                              {showSecrets[credential.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => copiarAlPortapapeles(credential.api_secret, "API Secret")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Información de Uso</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Estas credenciales son únicas para tu organización</li>
                <li>• Usar la API Key y API Secret en lugar de credenciales individuales</li>
                <li>• Las credenciales se generan de forma segura y única</li>
                <li>• Puedes tener múltiples credenciales activas</li>
                <li>• Elimina las credenciales que ya no uses</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default OrganizationApiCredentials;