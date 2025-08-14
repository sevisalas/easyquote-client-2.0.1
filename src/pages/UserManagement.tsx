import { useState, useEffect } from "react";
import { Plus, Trash2, Users, Building } from "lucide-react";
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
  organizacion?: {
    id: string;
    nombre: string;
    plan_suscripcion: string;
  };
  rol?: string;
}

interface Organizacion {
  id: string;
  name: string;
  subscription_plan: string;
  excel_limit: number;
  excel_extra: number;
  client_user_limit: number;
  client_user_extra: number;
  api_user_id: string;
  api_user_email?: string;
}

const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [emailNuevoUsuario, setEmailNuevoUsuario] = useState("");
  const [rolNuevoUsuario, setRolNuevoUsuario] = useState<"admin" | "user">("user");
  const [orgSeleccionadaId, setOrgSeleccionadaId] = useState("");
  const [nombreNuevaOrg, setNombreNuevaOrg] = useState("");
  const [planNuevaOrg, setPlanNuevaOrg] = useState<"api_base" | "api_pro" | "client_base" | "client_pro" | "custom">("api_base");
  const [emailApiUser, setEmailApiUser] = useState("");
  const { toast } = useToast();
  const { isSuperAdmin, isOrgAdmin, organization } = useSubscription();

  useEffect(() => {
    obtenerDatos();
  }, []);

  const obtenerDatos = async () => {
    try {
      if (isSuperAdmin) {
        // Obtener todas las organizaciones 
        const { data: datosOrgs } = await supabase
          .from('organizations')
          .select('*');
        
        setOrganizaciones(datosOrgs || []);

        // Obtener todos los usuarios con sus membresías
        const { data: datosMiembros } = await supabase
          .from('organization_members')
          .select(`
            user_id,
            role,
            organization:organizations(*)
          `);

        const mapaUsuarios = new Map();
        datosMiembros?.forEach(miembro => {
          if (!mapaUsuarios.has(miembro.user_id)) {
            mapaUsuarios.set(miembro.user_id, {
              id: miembro.user_id,
              organizacion: {
                id: miembro.organization.id,
                nombre: miembro.organization.name,
                plan_suscripcion: miembro.organization.subscription_plan
              },
              rol: miembro.role
            });
          }
        });

        setUsuarios(Array.from(mapaUsuarios.values()));
      } else if (isOrgAdmin && organization) {
        // Obtener solo usuarios de la organización del admin
        const { data: datosMiembros } = await supabase
          .from('organization_members')
          .select(`
            user_id,
            role,
            organization:organizations(*)
          `)
          .eq('organization_id', organization.id);

        const usuariosConEmails = await Promise.all(
          (datosMiembros || []).map(async (miembro) => {
            const { data: datosUsuario } = await supabase.auth.admin.getUserById(miembro.user_id);
            return {
              id: miembro.user_id,
              email: datosUsuario.user?.email || 'N/A',
              organizacion: {
                id: miembro.organization.id,
                nombre: miembro.organization.name,
                plan_suscripcion: miembro.organization.subscription_plan
              },
              rol: miembro.role
            };
          })
        );

        setUsuarios(usuariosConEmails);
      }
    } catch (error) {
      console.error('Error al obtener datos:', error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los datos de usuarios",
        variant: "destructive",
      });
    } finally {
      setCargando(false);
    }
  };

  const invitarUsuario = async () => {
    if (!emailNuevoUsuario || !orgSeleccionadaId) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos",
        variant: "destructive",
      });
      return;
    }

    try {
      // Registrar el usuario (necesitará confirmar email)
      const { data: datosAuth, error: errorAuth } = await supabase.auth.signUp({
        email: emailNuevoUsuario,
        password: Math.random().toString(36).slice(-8), // Contraseña temporal
      });

      if (errorAuth) throw errorAuth;

      if (datosAuth.user) {
        // Agregar usuario a la organización
        const { error: errorMiembro } = await supabase
          .from('organization_members')
          .insert({
            organization_id: orgSeleccionadaId,
            user_id: datosAuth.user.id,
            role: rolNuevoUsuario,
          });

        if (errorMiembro) throw errorMiembro;

        toast({
          title: "Éxito",
          description: `Usuario invitado exitosamente. Recibirá un email de confirmación.`,
        });

        setEmailNuevoUsuario("");
        setRolNuevoUsuario("user");
        setOrgSeleccionadaId("");
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

  const crearOrganizacion = async () => {
    if (!nombreNuevaOrg || !emailApiUser) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos",
        variant: "destructive",
      });
      return;
    }

    try {
      // Crear el usuario API
      const { data: datosAuth, error: errorAuth } = await supabase.auth.signUp({
        email: emailApiUser,
        password: Math.random().toString(36).slice(-8), // Contraseña temporal
      });

      if (errorAuth) throw errorAuth;

      if (datosAuth.user) {
        // Crear la organización
        const { error: errorOrg } = await supabase
          .from('organizations')
          .insert({
            name: nombreNuevaOrg,
            subscription_plan: planNuevaOrg,
            api_user_id: datosAuth.user.id,
          });

        if (errorOrg) throw errorOrg;

        toast({
          title: "Éxito",
          description: `Organización "${nombreNuevaOrg}" creada exitosamente.`,
        });

        setNombreNuevaOrg("");
        setEmailApiUser("");
        setPlanNuevaOrg("api_base");
        obtenerDatos();
      }
    } catch (error: any) {
      console.error('Error al crear organización:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la organización",
        variant: "destructive",
      });
    }
  };

  const eliminarUsuario = async (usuarioId: string, orgId: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', usuarioId)
        .eq('organization_id', orgId);

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

  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>
              No tienes permisos para acceder a la gestión de usuarios.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? "Gestionar todos los usuarios y organizaciones" : "Gestionar los usuarios de tu organización"}
          </p>
        </div>
      </div>

      {/* Crear Organización (Solo SuperAdmin) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crear Nueva Organización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="nombreOrg">Nombre de la Organización</Label>
                <Input
                  id="nombreOrg"
                  value={nombreNuevaOrg}
                  onChange={(e) => setNombreNuevaOrg(e.target.value)}
                  placeholder="Mi Empresa S.L."
                />
              </div>
              
              <div>
                <Label htmlFor="emailApi">Email del Usuario API</Label>
                <Input
                  id="emailApi"
                  type="email"
                  value={emailApiUser}
                  onChange={(e) => setEmailApiUser(e.target.value)}
                  placeholder="api@miempresa.com"
                />
              </div>
              
              <div>
                <Label htmlFor="planSuscripcion">Plan de Suscripción</Label>
                <Select value={planNuevaOrg} onValueChange={(value: any) => setPlanNuevaOrg(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api_base">API Base</SelectItem>
                    <SelectItem value="api_pro">API Pro</SelectItem>
                    <SelectItem value="client_base">Cliente Base</SelectItem>
                    <SelectItem value="client_pro">Cliente Pro</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={crearOrganizacion}
              disabled={!nombreNuevaOrg || !emailApiUser}
            >
              Crear Organización
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Vista de Organizaciones (Solo SuperAdmin) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organizaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organización</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Usuario API</TableHead>
                  <TableHead>Límite Excel</TableHead>
                  <TableHead>Límite Usuarios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizaciones.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.subscription_plan}</Badge>
                    </TableCell>
                    <TableCell>{org.api_user_email || 'N/A'}</TableCell>
                    <TableCell>{org.excel_limit + org.excel_extra}</TableCell>
                    <TableCell>{org.client_user_limit + org.client_user_extra}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invitar Usuario */}
      {(isSuperAdmin || isOrgAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Invitar Nuevo Usuario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              
              {isSuperAdmin && (
                <div>
                  <Label htmlFor="organization">Organización</Label>
                  <Select value={orgSeleccionadaId} onValueChange={setOrgSeleccionadaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar organización" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizaciones.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
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
            
            <Button 
              onClick={invitarUsuario}
              disabled={!emailNuevoUsuario || (isSuperAdmin && !orgSeleccionadaId)}
            >
              Invitar Usuario
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de Usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>{usuario.organizacion?.nombre || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{usuario.organizacion?.plan_suscripcion || 'N/A'}</Badge>
                  </TableCell>
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
                          <DialogTitle>Eliminar Usuario</DialogTitle>
                          <DialogDescription>
                            ¿Estás seguro de que quieres eliminar a {usuario.email} de la organización?
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="destructive"
                            onClick={() => eliminarUsuario(usuario.id, usuario.organizacion?.id || '')}
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

export default GestionUsuarios;