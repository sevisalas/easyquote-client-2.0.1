import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Shield, Eye, EyeOff, Key, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SuperAdmin {
  id: string;
  email: string;
  created_at: string;
}

const SuperAdminUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SuperAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Estados para edición
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<SuperAdmin | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    document.title = "Gestión de SuperAdmins | EasyQuote";
    
    if (!isSuperAdmin) {
      navigate('/');
      return;
    }
    
    loadSuperAdmins();
  }, [isSuperAdmin, navigate]);

  const loadSuperAdmins = async () => {
    setLoading(true);
    try {
      // Obtener todos los usuarios con rol superadmin
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'superadmin');

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setSuperAdmins([]);
        setLoading(false);
        return;
      }

      // Obtener información de los usuarios desde auth
      const userIds = roles.map(r => r.user_id);
      const { data: { session } } = await supabase.auth.getSession();
      
      const usersPromises = userIds.map(async (userId) => {
        const { data, error } = await supabase.functions.invoke('get-user-by-id', {
          body: { userId },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });
        
        if (error) {
          console.error('Error fetching user:', error);
          return null;
        }
        
        return data?.user;
      });

      const users = await Promise.all(usersPromises);
      const validUsers = users.filter(u => u !== null) as SuperAdmin[];
      
      setSuperAdmins(validUsers);
    } catch (error: any) {
      console.error('Error loading superadmins:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los superadmins",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setNewPassword(password);
  };

  const handleCreateSuperAdmin = async () => {
    if (!newEmail || !newPassword) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('create-superadmin', {
        body: { 
          email: newEmail, 
          password: newPassword 
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "SuperAdmin creado exitosamente",
      });

      setShowNewUserForm(false);
      setNewEmail("");
      setNewPassword("");
      loadSuperAdmins();
    } catch (error: any) {
      console.error('Error creating superadmin:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el superadmin",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSuperAdmin = async () => {
    if (!userToDelete) return;

    setDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('delete-superadmin', {
        body: { userId: userToDelete.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "SuperAdmin eliminado exitosamente",
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadSuperAdmins();
    } catch (error: any) {
      console.error('Error deleting superadmin:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el superadmin",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openEditDialog = (admin: SuperAdmin) => {
    setUserToEdit(admin);
    setEditEmail(admin.email);
    setEditPassword("");
    setEditDialogOpen(true);
  };

  const handleEditSuperAdmin = async () => {
    if (!userToEdit) return;

    if (!editEmail) {
      toast({
        title: "Error",
        description: "El email es obligatorio",
        variant: "destructive",
      });
      return;
    }

    if (editPassword && editPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setEditing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Actualizar email si cambió
      if (editEmail !== userToEdit.email) {
        const { error: emailError } = await supabase.functions.invoke('update-user-email', {
          body: { 
            userId: userToEdit.id, 
            newEmail: editEmail 
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });

        if (emailError) throw emailError;
      }

      // Actualizar contraseña si se proporcionó
      if (editPassword) {
        const { error: passwordError } = await supabase.functions.invoke('update-user-password', {
          body: { 
            email: editEmail,
            newPassword: editPassword 
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });

        if (passwordError) throw passwordError;
      }

      toast({
        title: "Éxito",
        description: "SuperAdmin actualizado exitosamente",
      });

      setEditDialogOpen(false);
      setUserToEdit(null);
      setEditEmail("");
      setEditPassword("");
      loadSuperAdmins();
    } catch (error: any) {
      console.error('Error editing superadmin:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el superadmin",
        variant: "destructive",
      });
    } finally {
      setEditing(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-secondary/5 via-background to-secondary/10 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/superadmin/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                Gestión de SuperAdmins
              </h1>
              <p className="text-muted-foreground text-lg mt-1">
                Administra los usuarios administradores del sistema EasyQuote
              </p>
            </div>
          </div>
        </div>

        {/* Formulario para nuevo SuperAdmin */}
        {showNewUserForm && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Crear Nuevo SuperAdmin
              </CardTitle>
              <CardDescription>
                Agrega un nuevo usuario con privilegios de administrador del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@ejemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateRandomPassword}
                  className="w-full mt-2"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Generar contraseña aleatoria
                </Button>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateSuperAdmin}
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? "Creando..." : "Crear SuperAdmin"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewUserForm(false);
                    setNewEmail("");
                    setNewPassword("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de SuperAdmins */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  SuperAdmins del Sistema
                </CardTitle>
                <CardDescription>
                  Lista de todos los administradores con acceso completo al sistema
                </CardDescription>
              </div>
              {!showNewUserForm && (
                <Button onClick={() => setShowNewUserForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo SuperAdmin
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Cargando...</p>
            ) : superAdmins.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay superadmins registrados
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Fecha de Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {superAdmins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.email}</TableCell>
                      <TableCell>
                        <Badge variant="default">SuperAdmin</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(admin.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(admin)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUserToDelete(admin);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de edición */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar SuperAdmin</DialogTitle>
              <DialogDescription>
                Modifica el email y/o contraseña del superadmin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="admin@ejemplo.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Dejar vacío para no cambiar"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Mínimo 6 caracteres. Dejar vacío si no deseas cambiar la contraseña.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const length = 12;
                    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
                    let password = "";
                    for (let i = 0; i < length; i++) {
                      password += charset.charAt(Math.floor(Math.random() * charset.length));
                    }
                    setEditPassword(password);
                  }}
                  className="w-full mt-2"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Generar contraseña aleatoria
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setUserToEdit(null);
                  setEditEmail("");
                  setEditPassword("");
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditSuperAdmin}
                disabled={editing}
              >
                {editing ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmación de eliminación */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar SuperAdmin</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres eliminar a {userToDelete?.email}?
                Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setUserToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSuperAdmin}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SuperAdminUsers;
