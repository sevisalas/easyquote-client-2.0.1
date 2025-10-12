import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface Suscriptor {
  id: string;
  name: string;
  subscription_plan: string;
  api_user_id: string;
  created_at: string;
}

const SubscribersList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, organization } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);

  useEffect(() => {
    // Si es org admin, redirigir a su página de usuarios
    if (!isSuperAdmin && organization) {
      navigate(`/suscriptores/${organization.id}/usuarios`);
      return;
    }

    // Si no es superadmin ni org admin, redirigir al inicio
    if (!isSuperAdmin && !organization) {
      navigate('/');
      return;
    }

    obtenerSuscriptores();
  }, [isSuperAdmin, organization, navigate]);

  const obtenerSuscriptores = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;

      setSuscriptores(data || []);
    } catch (error: any) {
      console.error('Error al obtener suscriptores:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron obtener los suscriptores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building className="h-8 w-8" />
            Suscriptores
          </h1>
          <p className="text-muted-foreground">
            Gestionar suscriptores y sus usuarios
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Suscriptores</CardTitle>
          <CardDescription>
            {suscriptores.length} suscriptor{suscriptores.length !== 1 ? 'es' : ''} registrado{suscriptores.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Fecha de creación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suscriptores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No hay suscriptores registrados
                  </TableCell>
                </TableRow>
              ) : (
                suscriptores.map((suscriptor) => (
                  <TableRow key={suscriptor.id}>
                    <TableCell className="font-medium">{suscriptor.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {suscriptor.subscription_plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(suscriptor.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/suscriptores/${suscriptor.id}/usuarios`)}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Gestionar usuarios
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscribersList;
