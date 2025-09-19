import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit, Download, Copy } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fetchQuote = async (id: string) => {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      items:quote_items(*),
      customer:customers(name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Presupuesto no encontrado');
  
  console.log('Quote detail data:', data); // Debug log
  return data;
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'pending': return 'Pendiente';
    case 'approved': return 'Aprobado';
    case 'rejected': return 'Rechazado';
    case 'sent': return 'Enviado';
    default: return status;
  }
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'approved': return 'default';
    case 'pending': return 'secondary';
    case 'sent': return 'outline';
    case 'rejected': return 'destructive';
    default: return 'secondary';
  }
};

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export default function QuoteDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchQuote(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Cargando presupuesto...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="container mx-auto py-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Error al cargar el presupuesto</p>
            <Button onClick={() => navigate('/presupuestos')} className="mt-4">
              Volver a Presupuestos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Presupuesto #{quote.quote_number}</CardTitle>
              <CardDescription className="mt-1">
                Fecha: {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate(`/presupuestos/editar/${quote.id}`)}
                size="sm"
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              <Button onClick={() => navigate('/presupuestos')} size="sm" variant="outline">
                Volver
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quote Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Información del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Cliente</label>
              <p className="text-sm font-medium">{quote.customer?.name || 'No especificado'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Estado</label>
              <div className="mt-1">
                <Badge variant={getStatusVariant(quote.status)}>
                  {statusLabel(quote.status)}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total</label>
              <p className="text-lg font-semibold">{fmtEUR(quote.final_price || 0)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Válido hasta</label>
              <p className="text-sm">
                {quote.valid_until 
                  ? format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: es })
                  : 'No especificado'
                }
              </p>
            </div>
          </div>
          
          {quote.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descripción</label>
              <p className="text-sm mt-1">{quote.description}</p>
            </div>
          )}

          {quote.notes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notas</label>
              <p className="text-sm mt-1">{quote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Artículos del Presupuesto</CardTitle>
        </CardHeader>
        <CardContent>
          {((quote.items && quote.items.length > 0) || (Array.isArray(quote.selections) && quote.selections.length > 0)) ? (
            <div className="space-y-3">
              {/* Mostrar items de la tabla quote_items */}
              {quote.items && quote.items.map((item: any, index: number) => (
                <div key={`item-${index}`} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.product_name || item.description || `Artículo ${index + 1}`}</h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cantidad: {item.quantity} × {fmtEUR(item.unit_price || 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{fmtEUR((item.total_price || item.subtotal) || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Mostrar items del campo selections (formato anterior) */}
              {Array.isArray(quote.selections) && quote.selections.map((selection: any, index: number) => (
                <div key={`selection-${index}`} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">
                        {quote.product_name || selection.itemDescription || `Producto ${index + 1}`}
                      </h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        {selection.outputs && selection.outputs.find((o: any) => o.name === 'PRECIO') && (
                          <span>Precio: {fmtEUR(selection.price || 0)}</span>
                        )}
                      </div>
                      {selection.outputs && selection.outputs.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {selection.outputs.map((output: any, outputIndex: number) => (
                            <div key={outputIndex}>
                              {output.name}: {output.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{fmtEUR(selection.price || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold">Total:</span>
                <span className="font-semibold text-lg">{fmtEUR(quote.final_price || 0)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Este presupuesto no tiene artículos añadidos</p>
              <Button 
                onClick={() => navigate(`/presupuestos/editar/${quote.id}`)}
                className="mt-4 gap-2"
              >
                <Edit className="h-4 w-4" />
                Añadir artículos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}