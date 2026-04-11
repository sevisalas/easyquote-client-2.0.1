import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building, Users, Pencil, Link2 } from "lucide-react";
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

const GROUP_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
];

const SubscribersList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, organization } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [suscriptores, setSuscriptores] = useState<Suscriptor[]>([]);

  useEffect(() => {
    if (!isSuperAdmin && organization) {
      navigate(`/suscriptores/${organization.id}/usuarios`);
      return;
    }
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

  // Identify api_user_ids shared by multiple orgs
  const groupMap = useMemo(() => {
    const countByApi: Record<string, string[]> = {};
    suscriptores.forEach((s) => {
      if (!countByApi[s.api_user_id]) countByApi[s.api_user_id] = [];
      countByApi[s.api_user_id].push(s.id);
    });
    const sharedApis = Object.entries(countByApi)
      .filter(([, ids]) => ids.length > 1)
      .map(([apiId]) => apiId);

    const map: Record<string, { colorClass: string; index: number; members: string[] }> = {};
    sharedApis.forEach((apiId, i) => {
      const members = suscriptores
        .filter((s) => s.api_user_id === apiId)
        .map((s) => s.name);
      map[apiId] = {
        colorClass: GROUP_COLORS[i % GROUP_COLORS.length],
        index: i + 1,
        members,
      };
    });
    return map;
  }, [suscriptores]);

  // Sort: grouped orgs first (by group index), then ungrouped alphabetically
  const sortedSuscriptores = useMemo(() => {
    return [...suscriptores].sort((a, b) => {
      const aGroup = groupMap[a.api_user_id];
      const bGroup = groupMap[b.api_user_id];
      if (aGroup && !bGroup) return -1;
      if (!aGroup && bGroup) return 1;
      if (aGroup && bGroup && aGroup.index !== bGroup.index) return aGroup.index - bGroup.index;
      return a.name.localeCompare(b.name);
    });
  }, [suscriptores, groupMap]);

  if (!isSuperAdmin) return null;

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
        <Button onClick={() => navigate('/usuarios/nuevo')}>
          Nuevo Suscriptor
        </Button>
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
                <TableHead>Grupo</TableHead>
                <TableHead>Fecha de creación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSuscriptores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay suscriptores registrados
                  </TableCell>
                </TableRow>
              ) : (
                sortedSuscriptores.map((suscriptor) => {
                  const group = groupMap[suscriptor.api_user_id];
                  return (
                    <TableRow key={suscriptor.id}>
                      <TableCell className="font-medium">{suscriptor.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {suscriptor.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {group ? (
                          <Badge className={`${group.colorClass} border-0 gap-1`} title={`Comparte recursos con: ${group.members.join(', ')}`}>
                            <Link2 className="h-3 w-3" />
                            Grupo {group.index}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(suscriptor.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/suscriptores/${suscriptor.id}/editar`)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/suscriptores/${suscriptor.id}/usuarios`)}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Usuarios
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscribersList;
