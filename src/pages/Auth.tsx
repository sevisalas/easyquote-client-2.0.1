import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Iniciar sesión | App";

    // If already logged in, redirect to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Obtener token de EasyQuote usando las credenciales guardadas (secure encrypted version)
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user?.id) {
          console.warn("No se pudo obtener el ID del usuario");
          return;
        }

        // Usar la función segura para obtener credenciales
        const { data: credentials, error: credError } = await supabase.rpc('get_user_credentials', {
          p_user_id: session.session.user.id
        });

        if (credError) {
          console.error("Error obteniendo credenciales:", credError);
          return;
        }

        if (credentials && credentials.length > 0) {
          const userCredentials = credentials[0];
          if (userCredentials.api_username && userCredentials.api_password) {
            const { data, error: fxError } = await supabase.functions.invoke("easyquote-auth", {
              body: { 
                email: userCredentials.api_username, 
                password: userCredentials.api_password 
              },
            });
            if (fxError) {
              console.error("easyquote-auth error", fxError);
            } else if ((data as any)?.token) {
              sessionStorage.setItem("easyquote_token", (data as any).token);
              console.log("Token de EasyQuote obtenido correctamente");
              
              // Disparar evento para notificar que el token fue actualizado
              window.dispatchEvent(new CustomEvent('easyquote-token-updated'));
            }
          } else {
            console.warn("Credenciales de EasyQuote incompletas");
          }
        } else {
          console.warn("No hay credenciales del API configuradas para este usuario");
        }
      } catch (e) {
        console.error("Error obteniendo el token de EasyQuote:", e);
      }

      toast({ title: "Bienvenido", description: "Sesión iniciada correctamente" });
      navigate("/", { replace: true });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo iniciar sesión", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center">
          <img
            src="/lovable-uploads/logo_transparente-removebg-preview.png"
            alt="EasyQuote Logo"
            className="h-20 w-auto mb-4"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fallbackApplied) {
                console.warn('Auth logo fallback also failed, hiding');
                img.style.display = 'none';
                return;
              }
              console.warn('Auth logo failed to load, switching to fallback');
              img.src = '/lovable-uploads/logo_transparente.png';
              img.dataset.fallbackApplied = 'true';
            }}
          />
          
          <CardTitle>Inicia sesión</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Procesando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;