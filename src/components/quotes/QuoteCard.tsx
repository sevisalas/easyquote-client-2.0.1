import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Eye, Copy, Trash2 } from "lucide-react";
import { CustomerName } from "./CustomerName";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface QuoteCardProps {
  quote: any;
  getUserName: (userId?: string | null) => string;
  fmtEUR: (n: any) => string;
  getStatusVariant: (s: string) => "success" | "destructive" | "secondary" | "outline";
  statusLabel: Record<string, string>;
  isHoldedActive: boolean;
  hasHoldedAccess?: boolean;
  onRefetch: () => void;
  handleDownloadHoldedPdf: (holdedEstimateId: string, holdedEstimateNumber: string, customerId: string) => void;
  currentUserId?: string;
  userRole?: string;
}

export function QuoteCard({
  quote,
  getUserName,
  fmtEUR,
  getStatusVariant,
  statusLabel,
  isHoldedActive,
  hasHoldedAccess = false,
  onRefetch,
  handleDownloadHoldedPdf,
  currentUserId,
  userRole
}: QuoteCardProps) {
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de que quieres eliminar este presupuesto?')) {
      try {
        const { error } = await supabase.from('quotes').delete().eq('id', quote.id);
        if (error) throw error;
        toast({ title: 'Presupuesto eliminado' });
        onRefetch();
      } catch (e: any) {
        toast({ title: 'Error al eliminar', description: e?.message, variant: 'destructive' });
      }
    }
  };

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow active:scale-[0.99] animate-fade-in">
      <CardContent className="p-4">
        {/* Header: Quote Number + Status */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Presupuesto</p>
            <p className="text-lg font-bold">{quote.quote_number}</p>
          </div>
          <Badge variant={getStatusVariant(quote.status)} className="text-xs px-2 py-1">
            {statusLabel[quote.status] || quote.status}
          </Badge>
        </div>

        {/* Customer */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm font-medium">
            <CustomerName customerId={quote.customer_id} />
          </p>
        </div>

        {/* User */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">Usuario</p>
          <p className="text-sm">{getUserName(quote.user_id)}</p>
        </div>

        {/* Date */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">Fecha</p>
          <p className="text-sm">{new Date(quote.created_at).toLocaleDateString("es-ES")}</p>
        </div>

        {/* Description */}
        {quote.description && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground">Descripción</p>
            <p className="text-sm">{quote.description}</p>
          </div>
        )}

        {/* Price */}
        <div className="mb-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">{fmtEUR(quote.final_price)}</p>
          </div>
        </div>

        {/* Holded Info */}
        {hasHoldedAccess && quote.holded_estimate_number && (
          <div className="mb-3 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Nº Holded</p>
                <p className="text-xs font-mono">{quote.holded_estimate_number}</p>
              </div>
              {quote.holded_estimate_id && isHoldedActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownloadHoldedPdf(quote.holded_estimate_id, quote.holded_estimate_number || quote.quote_number, quote.customer_id)}
                  className="h-9 w-9 p-0 touch-manipulation"
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
            onClick={() => navigate(`/presupuestos/${quote.id}`)}
            className="h-11 touch-manipulation"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver
          </Button>
          <Button
            size="lg"
            variant="default"
            onClick={() => navigate(`/presupuestos/nuevo?from=${quote.id}`)}
            className="h-11 touch-manipulation"
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </Button>
          {quote.status === 'draft' && (
            // Comercial solo puede eliminar sus propios presupuestos
            userRole !== 'comercial' || quote.user_id === currentUserId
          ) && (
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
