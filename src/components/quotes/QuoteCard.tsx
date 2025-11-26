import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, MoreVertical } from "lucide-react";
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
  onRefetch: () => void;
  handleDownloadHoldedPdf: (holdedEstimateId: string, holdedEstimateNumber: string, customerId: string) => void;
}

export function QuoteCard({
  quote,
  getUserName,
  fmtEUR,
  getStatusVariant,
  statusLabel,
  isHoldedActive,
  onRefetch,
  handleDownloadHoldedPdf
}: QuoteCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="mb-3 hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">{quote.quote_number}</span>
              <Badge variant={getStatusVariant(quote.status)} className="text-xs px-2 py-0.5">
                {statusLabel[quote.status] || quote.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(quote.created_at).toLocaleDateString("es-ES")}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-popover z-50">
              <DropdownMenuItem onClick={() => navigate(`/presupuestos/${quote.id}`)} className="cursor-pointer">
                Ver
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/presupuestos/nuevo?from=${quote.id}`)} className="cursor-pointer">
                Duplicar
              </DropdownMenuItem>
              {quote.status === 'draft' && (
                <DropdownMenuItem 
                  onClick={async () => {
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
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Cliente:</span>
            <span className="text-sm font-medium">
              <CustomerName customerId={quote.customer_id} />
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Usuario:</span>
            <span className="text-sm">{getUserName(quote.user_id)}</span>
          </div>

          {quote.description && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs text-muted-foreground">Descripción:</span>
              <span className="text-sm text-right flex-1">{quote.description}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-xs text-muted-foreground">Total:</span>
            <span className="text-base font-bold text-primary">{fmtEUR(quote.final_price)}</span>
          </div>

          {isHoldedActive && quote.holded_estimate_number && (
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">Nº Holded:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono">{quote.holded_estimate_number}</span>
                {quote.holded_estimate_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownloadHoldedPdf(quote.holded_estimate_id, quote.holded_estimate_number || quote.quote_number, quote.customer_id)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
