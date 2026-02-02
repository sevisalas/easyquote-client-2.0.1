import { useState } from "react";
import { useSupportRequests, SupportRequest, SupportRequestStatus, SupportRequestType } from "@/hooks/useSupportRequests";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Lightbulb, Bug, HelpCircle, Clock, CheckCircle, XCircle, 
  Loader2, Trash2, MessageSquare, Filter, Inbox
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect } from "react";

const typeIcons: Record<SupportRequestType, React.ReactNode> = {
  feature: <Lightbulb className="h-4 w-4 text-warning" />,
  bug: <Bug className="h-4 w-4 text-destructive" />,
  question: <HelpCircle className="h-4 w-4 text-primary" />,
};

const typeLabels: Record<SupportRequestType, string> = {
  feature: 'Funcionalidad',
  bug: 'Error',
  question: 'Consulta',
};

const statusConfig: Record<SupportRequestStatus, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: 'Pendiente', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  in_progress: { label: 'En progreso', icon: <Loader2 className="h-3 w-3" />, variant: 'default' },
  resolved: { label: 'Resuelto', icon: <CheckCircle className="h-3 w-3" />, variant: 'outline' },
  rejected: { label: 'Rechazado', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
};

export default function SuperAdminSupportRequests() {
  const { isSuperAdmin } = useSubscription();
  const navigate = useNavigate();
  const { requests, isLoading, updateRequest, deleteRequest } = useSupportRequests();
  
  const [filterType, setFilterType] = useState<SupportRequestType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<SupportRequestStatus | 'all'>('all');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<SupportRequestStatus>('pending');

  useEffect(() => {
    document.title = "Solicitudes de soporte | SuperAdmin";
    if (!isSuperAdmin) {
      navigate('/');
    }
  }, [isSuperAdmin, navigate]);

  if (!isSuperAdmin) return null;

  const filteredRequests = requests?.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  }) || [];

  const handleOpenDialog = (request: SupportRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || '');
    setNewStatus(request.status);
  };

  const handleSave = async () => {
    if (!selectedRequest) return;
    
    await updateRequest.mutateAsync({
      id: selectedRequest.id,
      status: newStatus,
      admin_notes: adminNotes,
      userEmail: selectedRequest.user_email,
      title: selectedRequest.title
    });
    
    setSelectedRequest(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar esta solicitud?')) {
      await deleteRequest.mutateAsync(id);
    }
  };

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;
  const inProgressCount = requests?.filter(r => r.status === 'in_progress').length || 0;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-secondary/5 via-background to-secondary/10 px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Solicitudes de soporte</h1>
          <p className="text-muted-foreground">
            Gestiona las solicitudes de funcionalidades, errores y consultas de los usuarios
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-warning">{pendingCount}</div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">{inProgressCount}</div>
              <p className="text-sm text-muted-foreground">En progreso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{requests?.filter(r => r.type === 'feature').length || 0}</div>
              <p className="text-sm text-muted-foreground">Funcionalidades</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-destructive">{requests?.filter(r => r.type === 'bug').length || 0}</div>
              <p className="text-sm text-muted-foreground">Errores</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as SupportRequestType | 'all')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="feature">Funcionalidad</SelectItem>
                  <SelectItem value="bug">Error</SelectItem>
                  <SelectItem value="question">Consulta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Estado</label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as SupportRequestStatus | 'all')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="resolved">Resuelto</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes ({filteredRequests.length})</CardTitle>
            <CardDescription>Haz clic en una solicitud para responder</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No hay solicitudes</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const status = statusConfig[request.status];
                    return (
                      <TableRow 
                        key={request.id}
                        className="cursor-pointer"
                        onClick={() => handleOpenDialog(request)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {typeIcons[request.type]}
                            <span className="text-sm">{typeLabels[request.type]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate font-medium">
                            {request.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {request.user_email || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                            {status.icon}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(request.created_at), { 
                            addSuffix: true, 
                            locale: es 
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(request);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(request.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog for responding */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedRequest && typeIcons[selectedRequest.type]}
                {selectedRequest?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest && typeLabels[selectedRequest.type]} - 
                {selectedRequest && formatDistanceToNow(new Date(selectedRequest.created_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">{selectedRequest?.description}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Estado</label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SupportRequestStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_progress">En progreso</SelectItem>
                    <SelectItem value="resolved">Resuelto</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notas / Respuesta</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Añade notas o una respuesta para el usuario..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={updateRequest.isPending}>
                {updateRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
