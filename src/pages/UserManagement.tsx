import { useState, useEffect } from "react";
import { Plus, Users, Building } from "lucide-react";
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
import { useNavigate } from "react-router-dom";

interface Suscriptor {
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
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombreNuevoSuscriptor, setNombreNuevoSuscriptor] = useState("");
  const [planNuevoSuscriptor, setPlanNuevoSuscriptor] = useState<"api_base" | "api_pro" | "client_base" | "client_pro" | "custom">("api_base");
  const [emailApiUser, setEmailApiUser] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const { toast } = useToast();
  const { isSuperAdmin, organization } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSuperAdmin || organization) {
      obtenerSuscriptores();
    }
  }, [isSuperAdmin, organization]);

  useEffect(() => {
    // Recargar datos cuando la página se enfoca
    const handleFocus = () => {
      if (isSuperAdmin || organization) {
        obtenerSuscriptores();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isSuperAdmin, organization]);

  const obtenerSuscriptores = async () => {
    try {
      let query = supabase.from('organizations').select('*');
      
      // Si no es superadmin, solo mostrar su propia organización
      if (!isSuperAdmin && organization) {
        query = query.eq('id', organization.id);
      }
      
      const { data: datosOrgs } = await query;
      
      setSuscriptores(datosOrgs || []);
    } catch (error) {
      console.error('Error al obtener suscriptores:', error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los suscriptores",
        variant: "destructive",
      });
    } finally {
      setCargando(false);
    }
  };

  const crearSuscriptor = async () => {
    if (!nombreNuevoSuscriptor || !emailApiUser) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos",
        variant: "destructive",
      });
      return;
    }

    try {
      // Crear usuario usando Edge Function que bypassa las restricciones
      const { data: result, error: errorCreacion } = await supabase.functions.invoke('create-user', {
        body: {
          email: emailApiUser,
          password: Math.random().toString(36).slice(-8), // Contraseña temporal
          organizationName: nombreNuevoSuscriptor,
          subscriptionPlan: planNuevoSuscriptor,
        }
      });

      if (errorCreacion) throw errorCreacion;
      if (!result?.success || !result?.user?.id) {
        throw new Error('No se pudo crear el usuario');
      }

      toast({
        title: "Éxito",
        description: `Suscriptor "${nombreNuevoSuscriptor}" creado exitosamente.`,
      });

      setNombreNuevoSuscriptor("");
      setEmailApiUser("");
      setPlanNuevoSuscriptor("api_base");
      setMostrarFormulario(false);
      obtenerSuscriptores();
    } catch (error: any) {
      console.error('Error al crear suscriptor:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el suscriptor",
        variant: "destructive",
      });
    }
  };

  if (!isSuperAdmin && !organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acceso denegado</CardTitle>
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
          <h1 className="text-3xl font-bold">
            {isSuperAdmin ? 'Gestión de suscriptores' : 'Gestión de usuarios'}
          </h1>
          <p className="text-muted-foreground">
            {isSuperAdmin ? 'Gestionar suscriptores y sus usuarios' : 'Gestionar usuarios de tu organización'}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setMostrarFormulario(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo suscriptor
          </Button>
        )}
      </div>

      {/* Formulario crear suscriptor - Solo para superadmin */}
      {isSuperAdmin && mostrarFormulario && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Crear nuevo suscriptor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="nombreSuscriptor">Nombre del suscriptor</Label>
                <Input
                  id="nombreSuscriptor"
                  value={nombreNuevoSuscriptor}
                  onChange={(e) => setNombreNuevoSuscriptor(e.target.value)}
                  placeholder="Mi Empresa S.L."
                />
              </div>
              
              <div>
                <Label htmlFor="emailApi">Email del usuario API</Label>
                <Input
                  id="emailApi"
                  type="email"
                  value={emailApiUser}
                  onChange={(e) => setEmailApiUser(e.target.value)}
                  placeholder="api@miempresa.com"
                />
              </div>
              
              <div>
                <Label htmlFor="planSuscripcion">Plan de suscripción</Label>
                <Select value={planNuevoSuscriptor} onValueChange={(value: any) => setPlanNuevoSuscriptor(value)}>
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
            
            <div className="flex gap-3">
              <Button 
                onClick={crearSuscriptor}
                disabled={!nombreNuevoSuscriptor || !emailApiUser}
              >
                Crear suscriptor
              </Button>
              <Button variant="outline" onClick={() => setMostrarFormulario(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de suscriptores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {isSuperAdmin ? 'Suscriptores' : 'Tu organización'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Suscriptor</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Límite excel</TableHead>
                <TableHead>Límite usuarios</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suscriptores.map((suscriptor) => (
                <TableRow key={suscriptor.id}>
                  <TableCell className="font-medium">{suscriptor.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{suscriptor.subscription_plan}</Badge>
                  </TableCell>
                  <TableCell>{suscriptor.excel_limit + suscriptor.excel_extra}</TableCell>
                  <TableCell>{suscriptor.client_user_limit + suscriptor.client_user_extra}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/suscriptores/${suscriptor.id}/usuarios`)}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Gestionar
                    </Button>
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