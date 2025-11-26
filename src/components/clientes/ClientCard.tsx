import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LocalClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  integration_id: string;
  created_at: string;
  source: 'local' | 'holded';
}

interface ClientCardProps {
  cliente: LocalClient;
  onDelete: (id: string) => void;
}

export const ClientCard = ({ cliente, onDelete }: ClientCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header con nombre y origen */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">
                {cliente.name || "Sin nombre"}
              </h3>
              <Badge 
                variant={cliente.source === 'local' ? 'default' : 'secondary'} 
                className="text-xs mt-1"
              >
                {cliente.source === 'local' ? 'Local' : 'Holded'}
              </Badge>
            </div>
          </div>

          {/* Información de contacto */}
          {(cliente.email || cliente.phone) && (
            <div className="space-y-2">
              {cliente.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a 
                    href={`mailto:${cliente.email}`}
                    className="text-muted-foreground hover:text-foreground truncate"
                  >
                    {cliente.email}
                  </a>
                </div>
              )}
              {cliente.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a 
                    href={`tel:${cliente.phone}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {cliente.phone}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          {cliente.notes && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {cliente.notes}
            </p>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            {cliente.source === 'local' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                  className="flex-1 h-9"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(cliente.id)}
                  className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex-1 text-center py-2">
                <span className="text-sm text-muted-foreground">Solo lectura</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
