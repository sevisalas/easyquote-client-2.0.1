import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LocalClient {
  id: string;
  name: string;
  trade_name: string;
  email: string;
  phone: string;
  notes: string;
  integration_id: string;
  created_at: string;
  source: 'local' | 'holded';
  tariff_id: string | null;
}

interface TariffOption {
  id: string;
  name: string;
  percentage: number;
  is_discount: boolean;
  is_active: boolean;
}

interface ClientCardProps {
  cliente: LocalClient;
  onDelete: (id: string) => void;
  isAdmin?: boolean;
  tariffs?: TariffOption[];
  onAssignTariff?: (customerId: string, tariffId: string | null) => void;
  isAssigningTariff?: boolean;
}

export const ClientCard = ({
  cliente,
  onDelete,
  isAdmin = false,
  tariffs = [],
  onAssignTariff,
  isAssigningTariff = false,
}: ClientCardProps) => {
  const navigate = useNavigate();

  return (
    <Card className="mb-3 cursor-pointer" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">
                {cliente.name || "Sin nombre"}
              </h3>
              {cliente.trade_name && (
                <p className="text-sm text-muted-foreground truncate">{cliente.trade_name}</p>
              )}
              <Badge
                variant={cliente.source === 'local' ? 'default' : 'secondary'}
                className="text-xs mt-1"
              >
                {cliente.source === 'local' ? 'Local' : 'Holded'}
              </Badge>
            </div>
          </div>

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

          {cliente.notes && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {cliente.notes}
            </p>
          )}

          {isAdmin && onAssignTariff && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Tarifa</p>
              <Select
                value={cliente.tariff_id ?? "none"}
                onValueChange={(value) => onAssignTariff(cliente.id, value === "none" ? null : value)}
                disabled={isAssigningTariff || tariffs.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={tariffs.length > 0 ? "Sin tarifa" : "No hay tarifas"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tarifa</SelectItem>
                  {tariffs.map((tariff) => (
                    <SelectItem key={tariff.id} value={tariff.id}>
                      {tariff.name} ({tariff.is_discount ? `-${tariff.percentage}%` : `+${tariff.percentage}%`}{!tariff.is_active ? " · inactiva" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tariffs.length === 0 && (
                <p className="text-xs text-muted-foreground">Crea primero una tarifa en Clientes → Tarifas.</p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
              className="flex-1 h-9"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            {cliente.source === 'local' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(cliente.id)}
                className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
