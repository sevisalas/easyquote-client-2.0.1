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
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = isLogin ? "Iniciar sesión | App" : "Crear cuenta | App";

    // If already logged in, redirect to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [isLogin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Obtener token de EasyQuote con las mismas credenciales y guardarlo
        try {
          const { data, error: fxError } = await supabase.functions.invoke("easyquote-auth", {
            body: { email, password },
          });
          if (fxError) {
            console.error("easyquote-auth error", fxError);
          } else if ((data as any)?.token) {
            localStorage.setItem("easyquote_token", (data as any).token);
          }
        } catch (e) {
          console.warn("No se pudo obtener el token de EasyQuote", e);
        }

        toast({ title: "Bienvenido", description: "Sesión iniciada correctamente" });
        navigate("/", { replace: true });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        toast({
          title: "Revisa tu correo",
          description: "Te enviamos un enlace para confirmar tu cuenta.",
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo completar la acción", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? "Inicia sesión" : "Crea tu cuenta"}</CardTitle>
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
              {loading ? "Procesando..." : isLogin ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin((v) => !v)}
              className="text-primary underline underline-offset-4"
            >
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
