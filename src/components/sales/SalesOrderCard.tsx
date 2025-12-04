import { useNavigate } from "react-router-dom";
import { Eye, Copy, Download, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerName } from "@/components/quotes/CustomerName";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SalesOrder } from "@/hooks/useSalesOrders";

const statusColors = {
  draft: "outline",
  pending: "default",
  in_production: "secondary",
  completed: "default",
} as const;

const statusLabels = {
  draft: "Borrador",
  pending: "Pendiente",
  in_production: "Producción",
  completed: "Completado",
};

const fmtEUR = (n: any) => {
  const num = typeof n === "number" ? n : parseFloat(String(n ?? "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(num)) return String(n ?? "");
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(num);
};

interface SalesOrderCardProps {
  order: SalesOrder;
  isHoldedActive: boolean;
  hasHoldedAccess?: boolean;
  onDuplicate: (orderId: string) => void;
  onDownloadHoldedPdf?: (holdedDocumentId: string, orderNumber: string) => void;
  onDelete?: () => void;
}

export function SalesOrderCard({ 
  order, 
  isHoldedActive, 
  hasHoldedAccess = false,
  onDuplicate, 
  onDownloadHoldedPdf,
  onDelete 
}: SalesOrderCardProps) {
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
      try {
        const { error } = await supabase.from('sales_orders').delete().eq('id', order.id);
        if (error) throw error;
        toast.success('Pedido eliminado');
        if (onDelete) onDelete();
      } catch (e: any) {
        toast.error('Error al eliminar', { description: e?.message });
      }
    }
  };

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow active:scale-[0.99] animate-fade-in">
      <CardContent className="p-4">
        {/* Header: Order Number + Status */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Pedido</p>
            <p className="text-lg font-bold">{order.order_number}</p>
          </div>
          <Badge variant={statusColors[order.status]} className="text-xs px-2 py-1">
            {statusLabels[order.status]}
          </Badge>
        </div>

        {/* Customer */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm font-medium">
            <CustomerName customerId={order.customer_id} />
          </p>
        </div>

        {/* Date */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">Fecha</p>
          <p className="text-sm">{new Date(order.order_date).toLocaleDateString("es-ES")}</p>
        </div>

        {/* Description */}
        {(order.description || order.title) && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">Descripción</p>
            <p className="text-sm">{order.description || order.title}</p>
          </div>
        )}

        {/* Price */}
        <div className="mb-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">{fmtEUR(order.final_price)}</p>
          </div>
        </div>

        {/* Holded Info */}
        {hasHoldedAccess && order.holded_document_number && (
          <div className="mb-3 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Nº Holded</p>
                <p className="text-xs font-mono">{order.holded_document_number}</p>
              </div>
              {order.holded_document_id && onDownloadHoldedPdf && isHoldedActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDownloadHoldedPdf(order.holded_document_id!, order.holded_document_number || order.order_number)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate(`/pedidos/${order.id}`)}
            className="h-11 touch-manipulation"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver
          </Button>
          <Button
            size="lg"
            variant="default"
            onClick={() => onDuplicate(order.id)}
            className="h-11 touch-manipulation"
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </Button>
          {order.status === 'draft' && (
            <Button
              size="lg"
              variant="destructive"
              onClick={handleDelete}
              className="h-11 touch-manipulation col-span-2"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
