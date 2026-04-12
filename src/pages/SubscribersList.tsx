import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building, Users, Pencil, Link2, Unlink, CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface Suscriptor {
  id: string;
  name: string;
  subscription_plan: string;
  resource_group_id: string | null;
  resource_group_name: string | null;
  api_user_id: string | null;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [grouping, setGrouping] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");

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
        .select('id, name, subscription_plan, resource_group_id, resource_group_name, api_user_id, created_at')
        .order('name');

      if (error) throw error;
      setSuscriptores((data || []) as Suscriptor[]);
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

  // Build group map from resource_group_id
  const groupMap = useMemo(() => {
    const byGroup: Record<string, Suscriptor[]> = {};
    suscriptores.forEach((s) => {
      if (s.resource_group_id) {
        if (!byGroup[s.resource_group_id]) byGroup[s.resource_group_id] = [];
        byGroup[s.resource_group_id].push(s);
      }
    });

    const map: Record<string, { colorClass: string; index: number; members: string[]; groupId: string; groupName: string | null }> = {};
    let idx = 0;
    Object.entries(byGroup)
      .filter(([, members]) => members.length > 1)
      .forEach(([groupId, members]) => {
        const colorClass = GROUP_COLORS[idx % GROUP_COLORS.length];
        const memberNames = members.map((m) => m.name);
        const gName = members[0].resource_group_name;
        members.forEach((m) => {
          map[m.id] = { colorClass, index: idx + 1, members: memberNames, groupId, groupName: gName };
        });
        idx++;
      });
    return map;
  }, [suscriptores]);

  // Sort: grouped orgs first, then alphabetically
  const sortedSuscriptores = useMemo(() => {
    return [...suscriptores].sort((a, b) => {
      const aGroup = groupMap[a.id];
      const bGroup = groupMap[b.id];
      if (aGroup && !bGroup) return -1;
      if (!aGroup && bGroup) return 1;
      if (aGroup && bGroup && aGroup.index !== bGroup.index) return aGroup.index - bGroup.index;
      return a.name.localeCompare(b.name);
    });
  }, [suscriptores, groupMap]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleGroupClick = () => {
    if (selected.size < 2) {
      toast({ title: "Selecciona al menos 2 suscriptores para agrupar", variant: "destructive" });
      return;
    }
    setGroupName("");
    setShowGroupDialog(true);
  };

  const handleGroupConfirm = async () => {
    if (!groupName.trim()) {
      toast({ title: "Introduce un nombre para el grupo", variant: "destructive" });
      return;
    }
    setGrouping(true);
    try {
      const selectedOrgs = suscriptores.filter((s) => selected.has(s.id));
      const existingGroupId = selectedOrgs.find((s) => s.resource_group_id)?.resource_group_id;
      const groupId = existingGroupId || crypto.randomUUID();

      const { error } = await supabase
        .from('organizations')
        .update({ resource_group_id: groupId, resource_group_name: groupName.trim() } as any)
        .in('id', Array.from(selected));

      if (error) throw error;

      toast({ title: "Grupo creado", description: `${selected.size} suscriptores agrupados como "${groupName.trim()}"` });
      setShowGroupDialog(false);
      exitSelectMode();
      await obtenerSuscriptores();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setGrouping(false);
    }
  };

  const handleUngroup = async () => {
    if (selected.size === 0) return;
    setGrouping(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ resource_group_id: null, resource_group_name: null } as any)
        .in('id', Array.from(selected));

      if (error) throw error;

      toast({ title: "Desagrupados", description: `${selected.size} suscriptores desagrupados` });
      exitSelectMode();
      await obtenerSuscriptores();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setGrouping(false);
    }
  };

  const handleRenameGroup = async () => {
    if (!renameGroupId || !renameValue.trim()) return;
    setGrouping(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ resource_group_name: renameValue.trim() } as any)
        .eq('resource_group_id', renameGroupId);

      if (error) throw error;

      toast({ title: "Grupo renombrado", description: `Nuevo nombre: "${renameValue.trim()}"` });
      setShowRenameDialog(false);
      await obtenerSuscriptores();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setGrouping(false);
    }
  };

  const anySelectedGrouped = useMemo(() => {
    return Array.from(selected).some((id) => !!groupMap[id]);
  }, [selected, groupMap]);

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
        <div className="flex gap-2">
          {!selectMode ? (
            <Button variant="outline" onClick={() => setSelectMode(true)}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Seleccionar
            </Button>
          ) : (
            <Button variant="outline" onClick={exitSelectMode}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
          <Button onClick={() => navigate('/usuarios/nuevo')}>
            Nuevo Suscriptor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Suscriptores</CardTitle>
              <CardDescription>
                {suscriptores.length} suscriptor{suscriptores.length !== 1 ? 'es' : ''} registrado{suscriptores.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {selectMode && selected.size > 0 && (
              <div className="flex gap-2">
                {selected.size >= 2 && (
                  <Button size="sm" onClick={handleGroupClick} disabled={grouping}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Agrupar ({selected.size})
                  </Button>
                )}
                {anySelectedGrouped && (
                  <Button size="sm" variant="outline" onClick={handleUngroup} disabled={grouping}>
                    <Unlink className="h-4 w-4 mr-2" />
                    Desagrupar
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {selectMode && <TableHead className="w-10"></TableHead>}
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
                  <TableCell colSpan={selectMode ? 6 : 5} className="text-center text-muted-foreground">
                    No hay suscriptores registrados
                  </TableCell>
                </TableRow>
              ) : (
                sortedSuscriptores.map((suscriptor) => {
                  const group = groupMap[suscriptor.id];
                  return (
                    <TableRow key={suscriptor.id}>
                      {selectMode && (
                        <TableCell>
                          <Checkbox
                            checked={selected.has(suscriptor.id)}
                            onCheckedChange={() => toggleSelect(suscriptor.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{suscriptor.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {suscriptor.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {group ? (
                          <Badge
                            className={`${group.colorClass} border-0 gap-1 cursor-pointer hover:opacity-80`}
                            title={`Comparte recursos con: ${group.members.join(', ')}. Haz clic para renombrar.`}
                            onClick={() => {
                              setRenameGroupId(group.groupId);
                              setRenameValue(group.groupName || `Grupo ${group.index}`);
                              setShowRenameDialog(true);
                            }}
                          >
                            <Link2 className="h-3 w-3" />
                            {group.groupName || `Grupo ${group.index}`}
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

      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nombre del grupo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Ej: Grupo Reprotel"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGroupConfirm()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>Cancelar</Button>
            <Button onClick={handleGroupConfirm} disabled={grouping || !groupName.trim()}>
              Crear grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar grupo</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nuevo nombre del grupo"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancelar</Button>
            <Button onClick={handleRenameGroup} disabled={grouping || !renameValue.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscribersList;
