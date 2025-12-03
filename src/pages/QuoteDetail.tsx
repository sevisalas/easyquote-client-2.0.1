import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, Download, Copy, CheckCircle, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { CustomerName } from "@/components/quotes/CustomerName";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { generateQuotePDF } from "@/utils/pdfGenerator";
import { useState } from "react";
import { useQuoteApproval } from "@/hooks/useQuoteApproval";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { isVisiblePrompt, type PromptDef } from "@/utils/promptVisibility";

const fetchQuote = async (id: string) => {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      items:quote_items(*),
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
  const { isHoldedActive } = useHoldedIntegration();
  const { membership } = useSubscription();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const { approveQuote, loading: isApproving } = useQuoteApproval();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchQuote(id!),
    enabled: !!id,
  });

  // Check if quote has multi-quantities
  const hasMultiQuantities = quote?.items?.some((item: any) => 
    item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1
  ) || false;

  // Check if all multi-quantity items have a selected quantity
  const allMultiQuantitiesSelected = () => {
    if (!quote?.items) return true;
    
    // Get items to validate based on selection
    let itemsToValidate = quote.items;
    
    // If user selected specific items, only validate those
    if (selectedItems.size > 0) {
      itemsToValidate = quote.items.filter((item: any) => selectedItems.has(item.id));
    }
    
    // Find multi-quantity items that need validation
    const multiItems = itemsToValidate.filter((item: any) => 
      item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1
    );
    
    if (multiItems.length === 0) return true;
    
    // All multi-quantity items must have a selected quantity
    return multiItems.every((item: any) => itemQuantities[item.id] !== undefined);
  };

  const canApproveAll = allMultiQuantitiesSelected();

  const handleGeneratePDF = async () => {
    if (!quote?.id) return;
    
    setIsGeneratingPDF(true);
    try {
      await generateQuotePDF(quote.id, {
        filename: `presupuesto-${quote.quote_number || 'draft'}.pdf`
      });
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

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

      // Generar nuevo número de presupuesto con formato YYYY-NNNN
      const year = new Date().getFullYear();
      
      // Obtener el último presupuesto del año
      const { count } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .like('quote_number', `${year}-%`);

      const nextNumber = (count || 0) + 1;
      const newNumber = `${year}-${String(nextNumber).padStart(4, '0')}`;
      console.log('Nuevo número de presupuesto:', newNumber);

      // Obtener organization_id del sessionStorage
      const organizationId = sessionStorage.getItem('selected_organization_id');

      // Crear nuevo presupuesto
      const { data: newQuote, error: insertError } = await supabase
        .from('quotes')
        .insert({
          user_id: session.session.user.id,
          quote_number: newNumber,
          customer_id: originalQuote.customer_id,
          title: null, // No copiar el título para que muestre el número correcto
          description: originalQuote.description,
          notes: originalQuote.notes,
          status: 'draft',
          valid_until: null,
          subtotal: originalQuote.subtotal,
          final_price: originalQuote.final_price,
          selections: originalQuote.selections,
          organization_id: organizationId,
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
          product_name: item.product_name || '',
          description: item.description || '',
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: string }) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', quoteId);

      if (error) throw error;

      // Si el estado es "sent" y Holded está activo, exportar automáticamente
      if (status === 'sent' && isHoldedActive) {
        console.log('🚀 Attempting to export to Holded after status change to sent');
        const { error: holdedError } = await supabase.functions.invoke('holded-export-estimate', {
          body: { quoteId }
        });

        if (holdedError) {
          console.error('❌ Error exporting to Holded:', holdedError);
          throw new Error('Error al exportar a Holded: ' + holdedError.message);
        }
        console.log('✅ Successfully exported to Holded');
      }
    },
    onSuccess: (_, variables) => {
      if (variables.status === 'sent' && isHoldedActive) {
        toast.success('Estado actualizado y presupuesto exportado a Holded');
      } else {
        toast.success('Estado actualizado correctamente');
      }
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error) => {
      toast.error('Error al actualizar el estado');
      console.error('Error:', error);
    },
  });

  const isEditable = quote?.status === 'draft' || quote?.status === 'pending';
  const canApprove = membership?.role === 'admin' || membership?.role === 'comercial';
  const isApprovable = quote?.status === 'sent' && canApprove;

  const handleEditOrDuplicate = () => {
    if (isEditable) {
      navigate(`/presupuestos/editar/${quote.id}`);
    } else {
      duplicateQuoteMutation.mutate(quote.id);
    }
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleApprove = async () => {
    if (!id) return;
    
    try {
      await approveQuote({
        quoteId: id,
        selectedItemIds: selectedItems.size > 0 ? Array.from(selectedItems) : undefined,
        itemQuantities,
      });
      
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales_orders'] });
      
      setSelectedItems(new Set());
      setItemQuantities({});
    } catch (error) {
      // Error already handled in hook
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
                Presupuesto {quote.quote_number}
              </CardTitle>
              <CardDescription className="mt-0.5">
                Fecha: {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {canApprove && (
                <>
                  {isApprovable ? (
                    <Button
                      onClick={handleApprove}
                      size="sm"
                      className="gap-2"
                      disabled={isApproving || !canApproveAll}
                      variant="default"
                      title={!canApproveAll ? 'Selecciona las cantidades de los artículos con opciones múltiples' : ''}
                    >
                      <CheckCircle className="h-4 w-4" />
                      {isApproving ? 'Aprobando...' : selectedItems.size > 0 ? `Aprobar ${selectedItems.size} items` : 'Aprobar todo'}
                    </Button>
                  ) : quote?.status === 'draft' ? (
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled
                      variant="outline"
                      title="Para aprobar el presupuesto, primero debes cambiarlo a estado 'Enviado'"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprobar (primero enviar)
                    </Button>
                  ) : quote?.status === 'approved' ? (
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled
                      variant="outline"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Ya aprobado
                    </Button>
                  ) : null}
                </>
              )}
              <Button
                onClick={handleEditOrDuplicate}
                size="sm"
                variant="outline"
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
                    {duplicateQuoteMutation.isPending ? 'Duplicando...' : 'Duplicar'}
                  </>
                )}
              </Button>
              <Button 
                onClick={handleGeneratePDF}
                size="sm" 
                variant="outline"
                className="gap-2"
                disabled={isGeneratingPDF}
              >
                <Download className="h-4 w-4" />
                {isGeneratingPDF ? 'Generando...' : 'PDF'}
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
              <p className="text-sm font-medium mt-0.5">
                <CustomerName customerId={quote.customer_id} fallback="No especificado" />
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">estado</label>
              <div className="mt-0.5">
                <Select 
                  value={quote.status} 
                  onValueChange={(value) => updateStatusMutation.mutate({ quoteId: quote.id, status: value })}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
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

          {isHoldedActive && hasMultiQuantities && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                (Este presupuesto tiene múltiples cantidades, cada cantidad se exportará como un artículo separado en Holded)
              </p>
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
            
            // Si no hay items en la tabla, usar selections como fallback
            let allItems: any[] = tableItems;
            
            if (tableItems.length === 0) {
              const jsonSelections = Array.isArray(quote.selections) ? quote.selections : [];
              allItems = jsonSelections.map((selection: any) => ({
                product_name: selection.itemDescription || '',
                description: '',
                price: selection.price || 0,
                outputs: selection.outputs || [],
                prompts: selection.prompts || {},
                multi: selection.multi,
                isFromJson: true
              }));
            }
            
            return allItems.length > 0 ? (
              <div className="space-y-2">
                {isApprovable && (
                  <div className="mb-3 p-2 bg-muted rounded-md text-sm text-muted-foreground">
                    {selectedItems.size > 0 
                      ? `${selectedItems.size} item(s) seleccionado(s) para aprobar`
                      : 'Selecciona items individuales o aprueba todo el presupuesto'}
                  </div>
                )}
                {allItems.map((item: any, index: number) => {
                  const multi = item.multi as any;
                  const hasMultipleQuantities = multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1;
                  const itemPrompts = item.prompts && typeof item.prompts === 'object' ? item.prompts : {};
                  const hasDetails = Object.keys(itemPrompts).length > 0; // Solo mostrar botón expandir si hay prompts
                  const isExpanded = expandedItems.has(index);
                  
                  return (
                    <Collapsible 
                      key={`item-${index}`}
                      open={isExpanded}
                      onOpenChange={(open) => {
                        setExpandedItems(prev => {
                          const newSet = new Set(prev);
                          if (open) {
                            newSet.add(index);
                          } else {
                            newSet.delete(index);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <div className={`bg-card border rounded-md p-2 border-r-2 hover:shadow transition-all duration-200 ${
                        item.accepted ? 'border-r-green-500 bg-green-50/5' : 'border-r-primary'
                      }`}>
                        <div className="flex justify-between items-start gap-3">
                          {isApprovable && !item.accepted && (
                            <Checkbox 
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => handleToggleItem(item.id)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">
                                {item.description || item.product_name || '-'}
                                {hasMultipleQuantities && (
                                  <span className="text-xs text-muted-foreground ml-2">(cantidad múltiple activada)</span>
                                )}
                              </p>
                              {item.accepted && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                  Aprobado {item.accepted_quantity && `(${item.accepted_quantity})`}
                                </Badge>
                              )}
                              {hasDetails && (
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                            </div>
                            
                            {/* Quantity selector for items with multiple quantities */}
                            {hasMultipleQuantities && isApprovable && !item.accepted && selectedItems.has(item.id) && (
                              <div className="mt-2 flex items-center gap-2">
                                <label className="text-xs font-medium text-muted-foreground">Selecciona cantidad:</label>
                                <Select
                                  value={itemQuantities[item.id]?.toString() || ''}
                                  onValueChange={(value) => {
                                    setItemQuantities(prev => ({
                                      ...prev,
                                      [item.id]: parseInt(value)
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="w-32 h-8">
                                    <SelectValue placeholder="Cantidad" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {multi.rows && multi.rows.length > 0 ? (
                                      multi.rows
                                        .filter((row: any) => {
                                          // Usar qty que es la propiedad real en los datos
                                          const qty = row.qty || row.quantity;
                                          return qty != null && qty !== '' && qty !== 0 && qty !== '0';
                                        })
                                        .map((row: any, idx: number) => {
                                          const qty = row.qty || row.quantity;
                                          return (
                                            <SelectItem key={idx} value={String(qty)}>
                                              {qty}
                                            </SelectItem>
                                          );
                                        })
                                    ) : (
                                      <SelectItem value="no-quantities" disabled>
                                        No hay cantidades disponibles
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            {/* Collapsible details - solo prompts, outputs NO se muestran en resumen */}
                            <CollapsibleContent className="mt-2 space-y-0.5">
                              {Object.keys(itemPrompts).length > 0 && (() => {
                                const visiblePrompts = Object.entries(itemPrompts)
                                  .filter(([key, promptData]: [string, any]) => {
                                    const value = typeof promptData === 'object' ? promptData.value : promptData;
                                    
                                    if (!value || value === '' || value === null) return false;
                                    if (typeof value === 'object') return false;
                                    if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('#'))) return false;
                                    
                                    const hasLabel = typeof promptData === 'object' && promptData.label && promptData.label.trim() !== '';
                                    return hasLabel;
                                  })
                                  .sort(([, a]: [string, any], [, b]: [string, any]) => (a.order ?? 999) - (b.order ?? 999));

                                if (visiblePrompts.length === 0) return null;

                                return visiblePrompts.map(([key, promptData]: [string, any], idx: number) => {
                                  const label = typeof promptData === 'object' ? promptData.label : key;
                                  const value = typeof promptData === 'object' ? promptData.value : promptData;
                                  const valueStr = String(value);
                                  
                                  if (valueStr.startsWith('#')) {
                                    return (
                                      <div key={idx} className="text-xs flex items-center gap-1.5">
                                        <span className="font-medium text-muted-foreground">{label}:</span>
                                        <div 
                                          className="w-4 h-4 rounded border shadow-sm"
                                          style={{ backgroundColor: valueStr }}
                                        />
                                        <span className="text-foreground">{valueStr}</span>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div key={idx} className="text-xs">
                                      <span className="font-medium text-muted-foreground">{label}:</span>{' '}
                                      <span className="text-foreground">{valueStr}</span>
                                    </div>
                                  );
                                });
                              })()}
                            </CollapsibleContent>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-primary">{fmtEUR(item.price || 0)}</p>
                          </div>
                        </div>
                      </div>
                    </Collapsible>
                  );
                })}
                
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
                        // Remove "Ajuste sobre el presupuesto" from name if present
                        const cleanName = additional.name
                          .replace(/\s*Ajuste sobre el presupuesto\s*/gi, '')
                          .replace(/\s*Ajuste sobre el pedido\s*/gi, '')
                          .trim();
                        let displayText = '';
                        
                        switch (additional.type) {
                          case 'percentage':
                            amount = (quote.subtotal * additional.value) / 100;
                            displayText = `${cleanName} (${additional.value}%)`;
                            break;
                          case 'net_amount':
                            amount = additional.value;
                            displayText = cleanName;
                            break;
                          case 'quantity_multiplier':
                            // Para multiplicadores, mostrar como factor
                            displayText = `${cleanName} (×${additional.value})`;
                            break;
                          default:
                            amount = additional.value;
                            displayText = cleanName;
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

    </div>
  );
}