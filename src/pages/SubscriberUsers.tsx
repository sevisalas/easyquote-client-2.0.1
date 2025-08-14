import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Users, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Usuario {
  id: string;
  email: string;
  rol: string;
}

interface Suscriptor {
  id: string;
  name: string;
  subscription_plan: string;
}

const UsuariosSuscriptor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [suscriptor, setSuscriptor] = useState<Suscriptor | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [emailNuevoUsuario, setEmailNuevoUsuario] = useState("");
  const [rolNuevoUsuario, setRolNuevoUsuario] = useState<"admin" | "user">("user");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/');
      return;
    }
    obtenerDatos();
  }, [id, isSuperAdmin, navigate]);

  const obtenerDatos = async () => {
    try {
      // Obtener datos del suscriptor
      const { data: datosSuscriptor, error: errorSuscriptor } = await supabase
        .from('organizations')
        .select('id, name, subscription_plan')
        .eq('id', id)
        .maybeSingle();

      if (errorSuscriptor) throw errorSuscriptor;
      
      if (!datosSuscriptor) {
        toast({
          title: "Error",
          description: "Suscriptor no encontrado",
          variant: "destructive",
        });
        navigate('/usuarios');
        return;
      }

      setSuscriptor(datosSuscriptor);

      // Obtener usuarios del suscriptor usando la función segura
      const { data: usuariosData, error: errorUsuarios } = await supabase
        .rpc('get_organization_users', { org_id: id });

      if (errorUsuarios) {
        console.error('Error al obtener usuarios:', errorUsuarios);
      }

      const usuariosFormateados = (usuariosData || []).map((usuario) => ({
        id: usuario.user_id,
        email: usuario.email || 'N/A',
        rol: usuario.role
      }));

      setUsuarios(usuariosFormateados);
    } catch (error: any) {
      console.error('Error al obtener datos:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron obtener los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const invitarUsuario = async () => {
    if (!emailNuevoUsuario) {
      toast({
        title: "Error",
        description: "Por favor ingrese un email",
        variant: "destructive",
      });
      return;
    }

    try {
      // Registrar el usuario
      const { data: datosAuth, error: errorAuth } = await supabase.auth.signUp({
        email: emailNuevoUsuario,
        password: Math.random().toString(36).slice(-8),
      });

      if (errorAuth) throw errorAuth;

      if (datosAuth.user) {
        // Agregar usuario al suscriptor
        const { error: errorMiembro } = await supabase
          .from('organization_members')
          .insert({
            organization_id: id,
            user_id: datosAuth.user.id,
            role: rolNuevoUsuario,
          });

        if (errorMiembro) throw errorMiembro;

        toast({
          title: "Éxito",
          description: "Usuario invitado exitosamente. Recibirá un email de confirmación.",
        });

        setEmailNuevoUsuario("");
        setRolNuevoUsuario("user");
        setMostrarFormulario(false);
        obtenerDatos();
      }
    } catch (error: any) {
      console.error('Error al invitar usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo invitar al usuario",
        variant: "destructive",
      });
    }
  };

  const eliminarUsuario = async (usuarioId: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', usuarioId)
        .eq('organization_id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Usuario eliminado exitosamente",
      });

      obtenerDatos();
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!suscriptor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Suscriptor no encontrado</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/usuarios')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Usuarios de {suscriptor.name}</h1>
          <p className="text-muted-foreground">
            Gestionar usuarios del suscriptor • Plan: {suscriptor.subscription_plan}
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setMostrarFormulario(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/suscriptores/${suscriptor.id}/editar`)}
        >
          <Edit className="h-4 w-4 mr-2" />
          Editar suscriptor
        </Button>
      </div>

      {/* Formulario invitar usuario */}
      {mostrarFormulario && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Invitar nuevo usuario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={emailNuevoUsuario}
                  onChange={(e) => setEmailNuevoUsuario(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              
              <div>
                <Label htmlFor="role">Rol</Label>
                <Select value={rolNuevoUsuario} onValueChange={(value: "admin" | "user") => setRolNuevoUsuario(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={invitarUsuario}
                disabled={!emailNuevoUsuario}
              >
                Invitar usuario
              </Button>
              <Button variant="outline" onClick={() => setMostrarFormulario(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuarios ({usuarios.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>
                    <Badge variant={usuario.rol === 'admin' ? 'default' : 'secondary'}>
                      {usuario.rol === 'admin' ? 'Administrador' : 'Usuario'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Eliminar usuario</DialogTitle>
                          <DialogDescription>
                            ¿Estás seguro de que quieres eliminar a {usuario.email} de este suscriptor?
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="destructive"
                            onClick={() => eliminarUsuario(usuario.id)}
                          >
                            Eliminar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsuariosSuscriptor;