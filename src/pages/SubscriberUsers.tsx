import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Users, Edit, Key, Eye, EyeOff } from "lucide-react";
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
  isPrincipal?: boolean;
}

interface Suscriptor {
  id: string;
  name: string;
  subscription_plan: string;
  api_user_email?: string;
  api_user_id?: string;
}

const UsuariosSuscriptor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, organization } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [suscriptor, setSuscriptor] = useState<Suscriptor | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [emailNuevoUsuario, setEmailNuevoUsuario] = useState("");
  const [rolNuevoUsuario, setRolNuevoUsuario] = useState<"admin" | "user">("user");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Estados para credenciales API
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin && !organization) {
      navigate('/');
      return;
    }
    
    // Si no es superadmin, verificar que el ID coincida con su organización
    if (!isSuperAdmin && organization && id !== organization.id) {
      navigate('/usuarios');
      return;
    }
    
    obtenerDatos();
  }, [id, isSuperAdmin, organization, navigate]);

  const obtenerDatos = async () => {
    try {
      // Obtener datos del suscriptor 
      const { data: datosSuscriptor, error: errorSuscriptor } = await supabase
        .from('organizations')
        .select(`
          id, 
          name, 
          subscription_plan,
          api_user_id
        `)
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

      // Obtener usuarios miembros adicionales del suscriptor 
      const { data: usuariosData, error: errorUsuarios } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', id);

      if (errorUsuarios) {
        console.error('Error al obtener usuarios:', errorUsuarios);
      }

      const usuariosFormateados: Usuario[] = [];

      // Solo agregar el usuario principal si realmente existe y no es el superadmin actual
      if (datosSuscriptor.api_user_id) {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Si el superadmin no es el api_user_id de esta organización, mostrar el verdadero propietario
        if (!isSuperAdmin || (isSuperAdmin && user?.id === datosSuscriptor.api_user_id)) {
          usuariosFormateados.push({
            id: datosSuscriptor.api_user_id,
            email: 'Administrador Principal de la API',
            rol: 'API Administrator', 
            isPrincipal: true
          });
        }
      }

      // Agregar usuarios miembros adicionales
      const usuariosMiembros = (usuariosData || []).map((usuario) => ({
        id: usuario.user_id,
        email: `Usuario ${usuario.user_id.substring(0,8)}`,
        rol: usuario.role === 'admin' ? 'Administrador' : 'Usuario',
        isPrincipal: false
      }));

      usuariosFormateados.push(...usuariosMiembros);
      setUsuarios(usuariosFormateados);
      
      // Si es superadmin, cargar credenciales API
      if (isSuperAdmin) {
        await cargarCredenciales(datosSuscriptor.api_user_id);
      }
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

  const cargarCredenciales = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('easyquote_credentials')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading credentials:', error);
      } else if (data) {
        setApiUsername(data.api_username);
        setApiPassword(data.api_password);
        setHasCredentials(true);
      }
    } catch (error) {
      console.error('Error:', error);
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

    if (!suscriptor?.api_user_id) {
      toast({
        title: "Error", 
        description: "No se puede obtener el usuario API del suscriptor",
        variant: "destructive",
      });
      return;
    }

    setLoadingCredentials(true);

    try {
      const credentialData = {
        user_id: suscriptor.api_user_id,
        api_username: apiUsername,
        api_password: apiPassword,
      };

      let result;
      if (hasCredentials) {
        result = await supabase
          .from('easyquote_credentials')
          .update(credentialData)
          .eq('user_id', suscriptor.api_user_id);
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
      await probarCredenciales();

    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar las credenciales",
        variant: "destructive",
      });
    } finally {
      setLoadingCredentials(false);
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
        toast({
          title: "Éxito",
          description: "Credenciales verificadas correctamente",
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

  if (!isSuperAdmin && !organization) {
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

      {/* Credenciales API EasyQuote - Solo SuperAdmin */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Credenciales API EasyQuote
            </CardTitle>
            <CardDescription>
              Gestionar las credenciales de EasyQuote para este suscriptor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={guardarCredenciales} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api-username">Usuario del API</Label>
                  <Input 
                    id="api-username" 
                    type="text" 
                    value={apiUsername} 
                    onChange={(e) => setApiUsername(e.target.value)} 
                    placeholder="Usuario del API de EasyQuote"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="api-password">Contraseña del API</Label>
                  <div className="relative">
                    <Input 
                      id="api-password" 
                      type={showPassword ? "text" : "password"} 
                      value={apiPassword} 
                      onChange={(e) => setApiPassword(e.target.value)} 
                      placeholder="Contraseña del API de EasyQuote"
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
              </div>

              <div className="flex gap-3">
                <Button 
                  type="submit" 
                  disabled={loadingCredentials || !apiUsername || !apiPassword}
                >
                  {loadingCredentials ? "Guardando..." : hasCredentials ? "Actualizar credenciales" : "Guardar credenciales"}
                </Button>
                {hasCredentials && (
                  <Button 
                    type="button"
                    onClick={probarCredenciales}
                    variant="outline"
                  >
                    Probar conexión
                  </Button>
                )}
              </div>
            </form>
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
                    <Badge variant={
                      usuario.isPrincipal ? 'default' : 
                      usuario.rol === 'Administrador' ? 'default' : 'secondary'
                    }>
                      {usuario.rol}
                    </Badge>
                    {usuario.isPrincipal && <span className="ml-2 text-xs text-muted-foreground">(Principal)</span>}
                  </TableCell>
                  <TableCell>
                    {usuario.isPrincipal ? (
                      <span className="text-sm text-muted-foreground">No se puede eliminar</span>
                    ) : (
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
                    )}
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