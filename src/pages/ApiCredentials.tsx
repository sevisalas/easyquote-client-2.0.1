import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Key } from "lucide-react";

const ApiCredentials = () => {
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    cargarCredenciales();
  }, []);

  const cargarCredenciales = async () => {
    try {
      const { data, error } = await supabase
        .from('easyquote_credentials')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading credentials:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las credenciales",
          variant: "destructive",
        });
      } else if (data) {
        setApiUsername(data.api_username);
        setApiPassword(data.api_password);
        setHasCredentials(true);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const guardarCredenciales = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiUsername || !apiPassword) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      const credentialData = {
        user_id: user.id,
        api_username: apiUsername,
        api_password: apiPassword,
      };

      let result;
      if (hasCredentials) {
        result = await supabase
          .from('easyquote_credentials')
          .update(credentialData)
          .eq('user_id', user.id);
      } else {
        result = await supabase
          .from('easyquote_credentials')
          .insert([credentialData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Éxito",
        description: "Credenciales guardadas correctamente",
      });

      setHasCredentials(true);

      // Probar las credenciales automáticamente
      await probarCredenciales();

    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar las credenciales",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const probarCredenciales = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("easyquote-auth", {
        body: { 
          email: apiUsername, 
          password: apiPassword 
        },
      });

      if (error) {
        toast({
          title: "Credenciales inválidas",
          description: "Las credenciales no funcionan con el API de EasyQuote",
          variant: "destructive",
        });
      } else if (data?.token) {
        localStorage.setItem("easyquote_token", data.token);
        toast({
          title: "Éxito",
          description: "Credenciales verificadas y token obtenido",
        });
      }
    } catch (error) {
      console.error('Error testing credentials:', error);
      toast({
        title: "Error",
        description: "No se pudieron probar las credenciales",
        variant: "destructive",
      });
    }
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
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="flex flex-col items-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Credenciales del API</CardTitle>
            <CardDescription className="text-center">
              Configura tus credenciales de EasyQuote para acceder al API
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={guardarCredenciales} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario del API</Label>
                <Input 
                  id="username" 
                  type="text" 
                  value={apiUsername} 
                  onChange={(e) => setApiUsername(e.target.value)} 
                  placeholder="Tu usuario del API de EasyQuote"
                  required 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña del API</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    value={apiPassword} 
                    onChange={(e) => setApiPassword(e.target.value)} 
                    placeholder="Tu contraseña del API de EasyQuote"
                    required 
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full"
              >
                {loading ? "Guardando..." : hasCredentials ? "Actualizar credenciales" : "Guardar credenciales"}
              </Button>
            </form>

            {hasCredentials && (
              <div className="mt-4">
                <Button 
                  onClick={probarCredenciales}
                  variant="outline" 
                  className="w-full"
                >
                  Probar conexión con API
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ApiCredentials;