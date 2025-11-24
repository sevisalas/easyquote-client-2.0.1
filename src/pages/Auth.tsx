import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
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

        // Usar la función segura para obtener credenciales de la organización
        const { data: credentials, error: credError } = await supabase.rpc('get_organization_easyquote_credentials', {
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
    <main className="min-h-screen bg-muted/30">
      <div className="container h-screen flex items-center justify-center p-0">
        <Card className="w-full max-w-5xl overflow-hidden border-0 shadow-2xl">
          <div className="grid md:grid-cols-2 h-full">
            {/* Left Side - Login Form */}
            <div className="flex flex-col justify-center p-8 md:p-12 bg-background">
              <div className="w-full max-w-sm mx-auto space-y-6">
                <div className="text-center space-y-4">
                  <img
                    src="/lovable-uploads/logo_transparente-removebg-preview.png"
                    alt="EasyQuote Logo"
                    className="h-20 w-auto mx-auto"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.dataset.fallbackApplied) {
                        img.style.display = 'none';
                        return;
                      }
                      img.src = '/lovable-uploads/logo_transparente.png';
                      img.dataset.fallbackApplied = 'true';
                    }}
                  />
                  <p className="text-sm text-muted-foreground">Inicia sesión en tu cuenta</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="Email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="h-11"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    {loading ? "PROCESANDO..." : "LOGIN"}
                  </Button>
                </form>
              </div>
            </div>

            {/* Right Side - Brand Panel */}
            <div className="hidden md:flex relative bg-secondary items-center justify-center overflow-hidden">
              <img
                src="/lovable-uploads/login-calculator.png"
                alt=""
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default Auth;