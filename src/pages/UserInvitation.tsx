import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

const UserInvitation = () => {
  const { isSuperAdmin } = useSubscription();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tienes permisos para acceder a esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Usar la API admin de Supabase para crear usuarios
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true // Confirmar email automáticamente
      });

      if (error) throw error;

      toast({
        title: "Usuario creado exitosamente",
        description: `Usuario ${email} ha sido creado correctamente.`
      });

      setEmail("");
      setPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crear Nuevo Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email del usuario</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="usuario@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña temporal</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Contraseña temporal"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creando usuario..." : "Crear Usuario"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserInvitation;