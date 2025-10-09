import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit, Download, Copy } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchQuote(id!),
    enabled: !!id,
  });

  const duplicateQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error('Usuario no autenticado');

      console.log('Duplicando presupuesto:', quoteId);

      // Obtener el presupuesto original con todos sus datos
      const { data: originalQuote, error: fetchError } = await supabase
        .from('quotes')
        .select('*, items:quote_items(*), quote_additionals:quote_additionals(*)')
        .eq('id', quoteId)
        .single();

      if (fetchError) {
        console.error('Error obteniendo presupuesto original:', fetchError);
        throw fetchError;
      }

      console.log('Presupuesto original:', originalQuote);
      console.log('Items originales:', originalQuote.items);
      console.log('Additionals originales:', originalQuote.quote_additionals);

      // Generar nuevo número de presupuesto con formato DD-MM-YYYY-NNNNN
      const today = new Date();
      const datePrefix = format(today, 'dd-MM-yyyy');
      
      // Obtener el último presupuesto del día
      const { data: todayQuotes } = await supabase
        .from('quotes')
        .select('quote_number')
        .like('quote_number', `${datePrefix}%`)
        .order('quote_number', { ascending: false })
        .limit(1);

      let dailyNumber = 1;
      if (todayQuotes && todayQuotes.length > 0) {
        const lastNumber = todayQuotes[0].quote_number;
        const parts = lastNumber.split('-');
        if (parts.length === 4) {
          dailyNumber = parseInt(parts[3]) + 1;
        }
      }

      const newNumber = `${datePrefix}-${String(dailyNumber).padStart(5, '0')}`;
      console.log('Nuevo número de presupuesto:', newNumber);

      // Crear nuevo presupuesto
      const { data: newQuote, error: insertError } = await supabase
        .from('quotes')
        .insert({
          user_id: session.session.user.id,
          quote_number: newNumber,
          customer_id: originalQuote.customer_id,
          title: originalQuote.title ? `${originalQuote.title} (copia)` : null,
          description: originalQuote.description,
          notes: originalQuote.notes,
          status: 'draft',
          valid_until: null,
          subtotal: originalQuote.subtotal,
          final_price: originalQuote.final_price,
          selections: originalQuote.selections,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creando nuevo presupuesto:', insertError);
        throw insertError;
      }

      console.log('Nuevo presupuesto creado:', newQuote);

      // Copiar items de quote_items
      if (originalQuote.items && originalQuote.items.length > 0) {
        console.log('Copiando', originalQuote.items.length, 'items');
        const itemsToInsert = originalQuote.items.map((item: any) => ({
          quote_id: newQuote.id,
          product_name: item.product_name,
          description: item.description,
          price: item.price,
          position: item.position,
          product_id: item.product_id,
          prompts: item.prompts,
          outputs: item.outputs,
          multi: item.multi,
          item_additionals: item.item_additionals,
          quantity: item.quantity,
          discount_percentage: item.discount_percentage,
        }));

        const { data: insertedItems, error: itemsError } = await supabase
          .from('quote_items')
          .insert(itemsToInsert)
          .select();

        if (itemsError) {
          console.error('Error copiando items:', itemsError);
          throw itemsError;
        }
        console.log('Items copiados:', insertedItems);
      }

      // Copiar ajustes de quote_additionals
      if (originalQuote.quote_additionals && originalQuote.quote_additionals.length > 0) {
        console.log('Copiando', originalQuote.quote_additionals.length, 'ajustes');
        const additionalsToInsert = originalQuote.quote_additionals.map((additional: any) => ({
          quote_id: newQuote.id,
          additional_id: additional.additional_id,
          name: additional.name,
          type: additional.type,
          value: additional.value,
        }));

        const { data: insertedAdditionals, error: additionalsError } = await supabase
          .from('quote_additionals')
          .insert(additionalsToInsert)
          .select();

        if (additionalsError) {
          console.error('Error copiando ajustes:', additionalsError);
          throw additionalsError;
        }
        console.log('Ajustes copiados:', insertedAdditionals);
      }

      return newQuote;
    },
    onSuccess: (newQuote) => {
      toast.success('Presupuesto duplicado correctamente');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/presupuestos/editar/${newQuote.id}`);
    },
    onError: (error) => {
      toast.error('Error al duplicar el presupuesto');
      console.error('Error:', error);
    },
  });

  const isEditable = quote?.status === 'draft' || quote?.status === 'pending';

  const handleEditOrDuplicate = () => {
    if (isEditable) {
      navigate(`/presupuestos/editar/${quote.id}`);
    } else {
      duplicateQuoteMutation.mutate(quote.id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground">Cargando presupuesto...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-destructive">Error al cargar el presupuesto</p>
            <Button onClick={() => navigate('/presupuestos')} className="mt-3">
              Volver a presupuestos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-2 space-y-3">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {quote.title ? quote.title : `Presupuesto #${quote.quote_number}`}
              </CardTitle>
              <CardDescription className="mt-0.5">
                {quote.title && (
                  <span>Número: {quote.quote_number} • </span>
                )}
                Fecha: {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleEditOrDuplicate}
                size="sm"
                className="gap-2"
                disabled={duplicateQuoteMutation.isPending}
              >
                {isEditable ? (
                  <>
                    <Edit className="h-4 w-4" />
                    Editar
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    {duplicateQuoteMutation.isPending ? 'Duplicando...' : 'Duplicar como nuevo'}
                  </>
                )}
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Información del presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">cliente</label>
              <p className="text-sm font-medium mt-0.5">{quote.customer?.name || 'No especificado'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">estado</label>
              <div className="mt-0.5">
                <Badge variant={getStatusVariant(quote.status)} className="text-xs">
                  {statusLabel(quote.status)}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">total</label>
              <p className="text-base font-semibold mt-0.5">{fmtEUR(quote.final_price || 0)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">válido hasta</label>
              <p className="text-sm mt-0.5">
                {quote.valid_until 
                  ? format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: es })
                  : 'No especificado'
                }
              </p>
            </div>
          </div>
          
          {(quote.description || quote.notes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {quote.description && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">descripción</label>
                  <p className="text-sm mt-0.5">{quote.description}</p>
                </div>
              )}
              {quote.notes && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">notas</label>
                  <p className="text-sm mt-0.5">{quote.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Artículos del presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {(() => {
            // Obtener items de la tabla quote_items
            const tableItems = quote.items || [];
            
            // Obtener items del JSON selections
            const jsonSelections = Array.isArray(quote.selections) ? quote.selections : [];
            const jsonItems = jsonSelections.map((selection: any, index: number) => ({
              product_name: selection.productName || quote.product_name || 'Artículo',
              description: selection.itemDescription || '',
              price: selection.price || 0,
              outputs: selection.outputs || [],
              prompts: selection.prompts || {},
              multi: selection.multi,
              isFromJson: true
            }));
            
            // Combinar ambas fuentes
            const allItems = [...tableItems, ...jsonItems];
            
            return allItems.length > 0 ? (
              <div className="space-y-2">
                {allItems.map((item: any, index: number) => (
                  <div key={`item-${index}`} className="bg-card border border-border rounded-md p-2 border-r-2 border-r-primary hover:shadow transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium mb-0.5">{item.product_name}</h4>
                        {item.description && item.description.trim() && (
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-base font-semibold text-primary">{fmtEUR(item.price || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Separator className="my-2" />
                
                {/* Desglose de totales */}
                <div className="bg-card rounded-md p-3 border border-border space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtotal:</span>
                    <span className="text-sm font-medium">{fmtEUR(quote.subtotal || 0)}</span>
                  </div>
                  
                  {/* Mostrar ajustes aplicados */}
                  {quote.quote_additionals && quote.quote_additionals.length > 0 && (
                    <>
                      {quote.quote_additionals.map((additional: any, index: number) => {
                        let amount = 0;
                        let displayText = '';
                        
                        switch (additional.type) {
                          case 'percentage':
                            amount = (quote.subtotal * additional.value) / 100;
                            displayText = `${additional.name} (${additional.value}%)`;
                            break;
                          case 'net_amount':
                            amount = additional.value;
                            displayText = additional.name;
                            break;
                          case 'quantity_multiplier':
                            // Para multiplicadores, mostrar como factor
                            displayText = `${additional.name} (×${additional.value})`;
                            break;
                          default:
                            amount = additional.value;
                            displayText = additional.name;
                        }
                        
                        if (additional.type !== 'quantity_multiplier') {
                          return (
                            <div key={index} className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">{displayText}:</span>
                              <span className={`text-sm font-medium ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {amount >= 0 ? '+' : ''}{fmtEUR(amount)}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </>
                  )}
                  
                  <Separator className="my-1.5" />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-base font-semibold text-foreground">Total del presupuesto:</span>
                    <span className="text-xl font-bold text-secondary">
                      {fmtEUR((() => {
                        let total = quote.subtotal || 0;
                        if (quote.quote_additionals) {
                          quote.quote_additionals.forEach((additional: any) => {
                            switch (additional.type) {
                              case 'percentage':
                                total += (quote.subtotal * additional.value) / 100;
                                break;
                              case 'net_amount':
                                total += additional.value;
                                break;
                              case 'quantity_multiplier':
                                total *= additional.value;
                                break;
                              default:
                                total += additional.value;
                            }
                          });
                        }
                        return total;
                      })())}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">Este presupuesto no tiene artículos añadidos</p>
                <p className="text-xs mt-1">Para añadir artículos, utiliza el botón "Editar" en la parte superior</p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Quote Adjustments */}
      {((quote.quote_additionals && Array.isArray(quote.quote_additionals) && quote.quote_additionals.length > 0)) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ajustes del presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {quote.quote_additionals.map((additional: any, index: number) => (
                <div key={`additional-${index}`} className="border rounded-md p-2">
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