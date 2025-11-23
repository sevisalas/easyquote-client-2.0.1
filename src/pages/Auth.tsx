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
                <div className="text-center space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">
                    Easy<span className="text-[hsl(348,83%,47%)]">Quote</span>
                  </h1>
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
                    className="w-full h-11 bg-[hsl(348,83%,47%)] hover:bg-[hsl(348,83%,42%)] text-white font-medium"
                  >
                    {loading ? "PROCESANDO..." : "LOGIN"}
                  </Button>
                </form>
              </div>
            </div>

            {/* Right Side - Brand Panel */}
            <div className="hidden md:flex relative bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 items-center justify-center p-12">
              <div className="absolute inset-0 bg-[url('/lovable-uploads/easyquote%201.png')] bg-cover bg-center opacity-20"></div>
              <div className="relative z-10 text-center space-y-4">
                <div className="mx-auto w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full text-purple-900/50" viewBox="0 0 200 200" fill="currentColor">
                    <rect x="40" y="40" width="120" height="140" rx="20" />
                    <rect x="50" y="50" width="100" height="40" rx="5" fill="white" opacity="0.3" />
                    <circle cx="70" cy="110" r="15" fill="white" opacity="0.3" />
                    <circle cx="100" cy="110" r="15" fill="white" opacity="0.3" />
                    <circle cx="130" cy="110" r="15" fill="white" opacity="0.3" />
                    <circle cx="70" cy="140" r="15" fill="white" opacity="0.3" />
                    <circle cx="100" cy="140" r="15" fill="white" opacity="0.3" />
                    <circle cx="130" cy="140" r="15" fill="white" opacity="0.3" />
                    <circle cx="70" cy="170" r="15" fill="white" opacity="0.3" />
                    <circle cx="100" cy="170" r="15" fill="white" opacity="0.3" />
                    <circle cx="130" cy="170" r="15" fill="hsl(348,83%,47%)" />
                    <path d="M 160 60 Q 180 80 180 100 Q 180 120 160 140" stroke="white" strokeWidth="8" fill="none" opacity="0.3" />
                    <path d="M 180 60 Q 200 80 200 100 Q 200 120 180 140" stroke="white" strokeWidth="8" fill="none" opacity="0.3" />
                  </svg>
                </div>
                <div className="text-white">
                  <h2 className="text-2xl font-bold">
                    Easy<span className="text-[hsl(348,83%,47%)]">Quote</span>
                  </h2>
                  <p className="text-purple-200 text-sm mt-2">
                    the Spreadsheets Integration API
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default Auth;