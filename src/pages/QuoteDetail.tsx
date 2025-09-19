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
      customer:customers(name),
      quote_additionals:quote_additionals(*)
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
    case 'draft': return 'Borrador';
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
              <CardTitle className="text-xl">
                {quote.title ? quote.title : `Presupuesto #${quote.quote_number}`}
              </CardTitle>
              <CardDescription className="mt-1">
                {quote.title && (
                  <span>Número: {quote.quote_number} • </span>
                )}
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
          <CardTitle className="text-lg">Información del presupuesto</CardTitle>
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
                <div key={`item-${index}`} className="bg-card border border-border rounded-lg p-4 border-r-4 border-r-primary hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground mb-1">{item.product_name || item.description || `Artículo ${index + 1}`}</h4>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="bg-muted px-2 py-1 rounded-md">
                          Cantidad: {item.quantity}
                        </span>
                        <span>×</span>
                        <span className="font-medium">{fmtEUR(item.unit_price || 0)}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-primary">{fmtEUR((item.total_price || item.subtotal) || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Mostrar items del campo selections (formato anterior) */}
              {Array.isArray(quote.selections) && quote.selections.map((selection: any, index: number) => {
                // Buscar el nombre del producto en los outputs o usar descripción
                const productName = selection.itemDescription || 
                  (selection.outputs && selection.outputs.find((o: any) => o.name === 'PRODUCTO')?.value) ||
                  `Producto ${index + 1}`;
                
                return (
                  <div key={`selection-${index}`} className="bg-card border border-border rounded-lg p-4 border-r-4 border-r-primary hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground mb-1">{productName}</h4>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-primary">{fmtEUR(selection.price || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <Separator className="my-4" />
              
              <div className="bg-card rounded-lg p-4 border border-border border-r-4 border-r-secondary hover:shadow-md transition-all duration-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-foreground">Total del Presupuesto:</span>
                  <span className="text-2xl font-bold text-secondary">{fmtEUR(quote.final_price || 0)}</span>
                </div>
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

      {/* Quote Additionals */}
      {((quote.quote_additionals && Array.isArray(quote.quote_additionals) && quote.quote_additionals.length > 0)) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Adicionales del Presupuesto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quote.quote_additionals.map((additional: any, index: number) => (
                <div key={`additional-${index}`} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{additional.name}</h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        Tipo: {additional.type === 'percentage' ? 'Porcentaje' : 'Valor fijo'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-sm">
                        {additional.type === 'percentage' ? `${additional.value}%` : fmtEUR(additional.value || 0)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/presupuestos/editar/${quote.id}`)}
                        className="gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}