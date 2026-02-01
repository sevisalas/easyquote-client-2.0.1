import { useSupportRequests, SupportRequestStatus, SupportRequestType } from "@/hooks/useSupportRequests";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Bug, HelpCircle, Clock, CheckCircle, XCircle, Loader2, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

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
  in_progress: { label: 'En progreso', icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: 'default' },
  resolved: { label: 'Resuelto', icon: <CheckCircle className="h-3 w-3" />, variant: 'outline' },
  rejected: { label: 'Rechazado', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
};

export function UserRequestsList() {
  const { requests, isLoading } = useSupportRequests();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Cargando solicitudes...</p>
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No has enviado ninguna solicitud todavía</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis solicitudes</CardTitle>
        <CardDescription>Historial de tus solicitudes enviadas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => {
          const status = statusConfig[request.status];
          return (
            <div 
              key={request.id} 
              className="p-4 border rounded-lg bg-muted/30 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {typeIcons[request.type]}
                  <span className="font-medium truncate">{request.title}</span>
                </div>
                <Badge variant={status.variant} className="flex items-center gap-1 shrink-0">
                  {status.icon}
                  {status.label}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-2">
                {request.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {typeLabels[request.type]}
                  </Badge>
                </span>
                <span>
                  {formatDistanceToNow(new Date(request.created_at), { 
                    addSuffix: true, 
                    locale: es 
                  })}
                </span>
              </div>

              {request.admin_notes && (
                <div className="mt-2 p-2 bg-primary/5 rounded text-sm">
                  <strong>Respuesta:</strong> {request.admin_notes}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
