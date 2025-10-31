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
import { useHoldedSalesAccounts } from "@/hooks/useHoldedSalesAccounts";

interface Usuario {
  id: string;
  email: string;
  rol: string;
  isPrincipal?: boolean;
  display_name?: string;
  cuenta_holded?: string;
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
  const { isSuperAdmin, organization, membership } = useSubscription();
  const { data: salesAccounts = [] } = useHoldedSalesAccounts(id);
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
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [generatedUserEmail, setGeneratedUserEmail] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // Estados para cambio de contraseña
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Estados para edición de usuario
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCuentaHolded, setEditCuentaHolded] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

      // Obtener usuarios miembros con sus emails usando el edge function
      const { data: usersResponse, error: errorUsuarios } = await supabase.functions.invoke(
        'get-organization-users',
        { body: { organizationId: id } }
      );

      console.log('🔍 Respuesta usuarios:', usersResponse);

      if (errorUsuarios) {
        console.error('Error al obtener usuarios:', errorUsuarios);
      }

      const usuariosFormateados: Usuario[] = [];

      // Mostrar TODOS los usuarios de organization_members
      if (usersResponse?.users && usersResponse.users.length > 0) {
        for (const usuario of usersResponse.users) {
          usuariosFormateados.push({
            id: usuario.id,
            email: usuario.email || 'Sin email',
            rol: usuario.role === 'admin' ? 'Administrador' : 'Usuario',
            isPrincipal: false,
            display_name: usuario.display_name,
            cuenta_holded: usuario.cuenta_holded
          });
        }
      }

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

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNuevoUsuario.trim())) {
      toast({
        title: "Error",
        description: "Por favor ingrese un email válido",
        variant: "destructive",
      });
      return;
    }

    try {
      const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const emailToCreate = emailNuevoUsuario.trim();
      
      // Usar el edge function para crear el usuario
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: emailToCreate,
          password: password,
          role: rolNuevoUsuario,
          organizationId: id,
          isNewMember: true
        }
      });

      if (error) {
        console.error('Error en la invocación:', error);
        throw new Error(error.message || "Error al comunicarse con el servidor");
      }

      // Manejar errores específicos del edge function
      if (data?.error) {
        // Mostrar mensaje específico para usuario existente
        if (data.code === 'USER_EXISTS') {
          toast({
            title: "Usuario ya existe",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error);
      }

      if (!data?.success) {
        throw new Error("No se pudo crear el usuario correctamente");
      }

      // Guardar credenciales para mostrar en el modal
      setGeneratedPassword(password);
      setGeneratedUserEmail(emailToCreate);
      setShowPasswordDialog(true);

      // Limpiar formulario
      setEmailNuevoUsuario("");
      setRolNuevoUsuario("user");
      setMostrarFormulario(false);
      obtenerDatos();
    } catch (error: any) {
      console.error('Error al crear usuario:', error);
      
      // Evitar mostrar toast duplicado si ya se mostró uno específico
      if (error.message && !error.message.includes('ya existe')) {
        toast({
          title: "Error al crear usuario",
          description: error.message || "No se pudo crear el usuario",
          variant: "destructive",
        });
      }
    }
  };

  const cambiarContraseña = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      const { data, error } = await supabase.functions.invoke("update-user-password", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          email: selectedUserEmail,
          newPassword: newPassword,
        }
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Éxito",
        description: "Contraseña actualizada correctamente",
      });

      setShowChangePasswordDialog(false);
      setNewPassword("");
      setSelectedUserId(null);
      setSelectedUserEmail(null);
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const generarNuevaContraseña = () => {
    const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    setNewPassword(password);
  };

  const abrirEdicionUsuario = (usuario: Usuario) => {
    setEditingUser(usuario);
    setEditDisplayName(usuario.display_name || '');
    setEditCuentaHolded(usuario.cuenta_holded || '');
    setShowEditDialog(true);
  };

  const guardarEdicionUsuario = async () => {
    if (!editingUser) return;

    setSavingEdit(true);

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({
          display_name: editDisplayName.trim() || null,
          cuenta_holded: editCuentaHolded.trim() || null,
        })
        .eq('user_id', editingUser.id)
        .eq('organization_id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Usuario actualizado correctamente",
      });

      setShowEditDialog(false);
      setEditingUser(null);
      obtenerDatos();
    } catch (error: any) {
      console.error('Error al actualizar usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const abrirEditarUsuario = (usuario: Usuario) => {
    setEditingUser(usuario);
    setEditDisplayName(usuario.display_name || '');
    setEditCuentaHolded(usuario.cuenta_holded || '');
    setShowEditDialog(true);
  };

  const guardarUsuario = async () => {
    if (!editingUser) return;

    setSavingEdit(true);

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({
          display_name: editDisplayName || null,
          cuenta_holded: editCuentaHolded || null
        })
        .eq('user_id', editingUser.id)
        .eq('organization_id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Usuario actualizado correctamente",
      });

      setShowEditDialog(false);
      setEditingUser(null);
      setEditDisplayName("");
      setEditCuentaHolded("");
      obtenerDatos();
    } catch (error: any) {
      console.error('Error al guardar usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el usuario",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
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
      const { data, error } = await supabase.rpc('get_user_credentials', { 
        p_user_id: userId 
      });

      if (error) {
        console.error('Error loading credentials:', error);
      } else if (data && data.length > 0) {
        const credentials = data[0];
        setApiUsername(credentials.api_username || '');
        setApiPassword(credentials.api_password || '');
        setCredentialId(credentials.id);
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
      let result;
      if (hasCredentials && credentialId) {
        // Update credentials using the secure function
        const updateResult = await supabase.rpc('set_user_credentials', {
          p_user_id: suscriptor.api_user_id,
          p_username: apiUsername,
          p_password: apiPassword
        });
        
        if (updateResult.error) {
          throw updateResult.error;
        }
        result = { error: null };
      } else {
        // Insert new credentials using the secure function
        const insertResult = await supabase.rpc('set_user_credentials', {
          p_user_id: suscriptor.api_user_id,
          p_username: apiUsername,
          p_password: apiPassword
        });
        
        if (insertResult.error) {
          throw insertResult.error;
        }
        result = { error: null };
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
            Gestionar usuarios del suscriptor
            {isSuperAdmin && ` • Plan: ${suscriptor.subscription_plan}`}
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setMostrarFormulario(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>
      </div>

      {/* Botón de editar suscriptor - SOLO para superadmin */}
      {isSuperAdmin && (
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/suscriptores/${suscriptor.id}/editar`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar suscriptor
          </Button>
        </div>
      )}

      {/* Mensaje si no hay usuarios */}
      {usuarios.length === 0 && !mostrarFormulario && (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay usuarios todavía</h3>
            <p className="text-muted-foreground mb-4">
              Crea el primer usuario administrador para que pueda acceder a la aplicación
            </p>
            <Button onClick={() => setMostrarFormulario(true)} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Crear primer usuario
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Formulario crear usuario */}
      {mostrarFormulario && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crear nuevo usuario
            </CardTitle>
            <CardDescription>
              {usuarios.length === 0 
                ? "Este será el primer usuario administrador que podrá acceder a la aplicación"
                : "Agregar un nuevo usuario a la organización"}
            </CardDescription>
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
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="user">Usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={invitarUsuario}
                disabled={!emailNuevoUsuario}
              >
                Crear usuario
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
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>
                    <div className="font-medium">
                      {usuario.display_name || usuario.email}
                    </div>
                    {usuario.cuenta_holded && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        {(() => {
                          const account = salesAccounts.find(acc => acc.holded_account_id === usuario.cuenta_holded);
                          return account ? (
                            <>
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: account.color || '#6486f6' }}
                              />
                              <span>{account.name}</span>
                            </>
                          ) : (
                            <span>Cuenta: {usuario.cuenta_holded}</span>
                          );
                        })()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {usuario.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      usuario.isPrincipal ? 'default' : 
                      usuario.rol === 'Administrador' ? 'default' : 'secondary'
                    }>
                      {usuario.rol}
                    </Badge>
                    {isSuperAdmin && usuario.isPrincipal && (
                      <span className="ml-2 text-xs text-muted-foreground">(Principal)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {/* Botón editar */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => abrirEditarUsuario(usuario)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      {/* Botón cambiar contraseña */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedUserId(usuario.id);
                          setSelectedUserEmail(usuario.email);
                          setShowChangePasswordDialog(true);
                        }}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      
                      {/* Botón eliminar */}
                      {usuario.isPrincipal ? (
                        <span className="text-sm text-muted-foreground ml-2">No se puede eliminar</span>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal para mostrar la contraseña generada */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuario creado exitosamente</DialogTitle>
            <DialogDescription>
              Guarda esta contraseña temporal y compártela con el usuario. No podrás verla nuevamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Email del usuario</Label>
              <p className="font-mono text-lg font-semibold">{generatedUserEmail}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Contraseña temporal</Label>
              <p className="font-mono text-lg font-semibold break-all">{generatedPassword}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              El usuario puede iniciar sesión con estas credenciales y cambiar su contraseña desde su perfil.
            </p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${generatedUserEmail}\nContraseña: ${generatedPassword}`);
                toast({
                  title: "Copiado",
                  description: "Credenciales copiadas al portapapeles",
                });
              }}
              variant="outline"
            >
              Copiar credenciales
            </Button>
            <Button onClick={() => {
              setShowPasswordDialog(false);
              setGeneratedPassword(null);
              setGeneratedUserEmail(null);
            }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar usuario */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Modificar información del usuario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Nombre de usuario</Label>
              <Input
                id="display-name"
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Nombre para mostrar"
              />
              <p className="text-sm text-muted-foreground">
                Este será el nombre que se muestra en la aplicación
              </p>
            </div>
            
            {suscriptor?.subscription_plan && (
              <div className="space-y-2">
                <Label htmlFor="cuenta-holded">Cuenta de Ventas (Holded)</Label>
                <Select
                  value={editCuentaHolded}
                  onValueChange={setEditCuentaHolded}
                  disabled={!isSuperAdmin && membership?.role !== 'admin'}
                >
                  <SelectTrigger id="cuenta-holded">
                    <SelectValue placeholder="Seleccionar cuenta de ventas" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="">Sin asignar</SelectItem>
                    {salesAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.holded_account_id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: account.color || '#6486f6' }}
                          />
                          <span>{account.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {!isSuperAdmin && membership?.role !== 'admin' 
                    ? "Solo los administradores pueden editar este campo"
                    : "Esta cuenta se usará al exportar presupuestos a Holded"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setEditingUser(null);
                setEditDisplayName("");
                setEditCuentaHolded("");
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={guardarUsuario}
              disabled={savingEdit}
            >
              {savingEdit ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para cambiar contraseña */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Cambiar la contraseña para {selectedUserEmail}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresa la nueva contraseña"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Mínimo 6 caracteres
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={generarNuevaContraseña}
              className="w-full"
            >
              Generar contraseña aleatoria
            </Button>
          </div>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setShowChangePasswordDialog(false);
                setNewPassword("");
                setSelectedUserId(null);
                setSelectedUserEmail(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={cambiarContraseña}
              disabled={changingPassword || !newPassword || newPassword.length < 6}
            >
              {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsuariosSuscriptor;