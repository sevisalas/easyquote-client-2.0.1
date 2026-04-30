import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, Download, Copy, CheckCircle, ChevronDown, Eye, EyeOff, FileText, Ban, Mail, Loader2, Globe } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { CustomerName } from "@/components/quotes/CustomerName";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { generateQuotePDF } from "@/utils/pdfGenerator";
import { useState, useMemo } from "react";
import { useQuoteApproval } from "@/hooks/useQuoteApproval";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { isVisiblePrompt, type PromptDef } from "@/utils/promptVisibility";
import DocumentAttachments from "@/components/quotes/DocumentAttachments";
import { resolveApprovedQuoteItemState } from "@/utils/approvedMultiQuantity";
import { resolveItemQuantityStrict } from "@/utils/strictQuantity";

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
    case 'sent': return 'Preparado';
    case 'cancelled': return 'Anulado';
    default: return status;
  }
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'approved': return 'default';
    case 'pending': return 'secondary';
    case 'sent': return 'outline';
    case 'rejected': return 'destructive';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
};

const fmtEUR = (amount: number) => {
  const parts = Math.abs(amount).toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = amount < 0 ? '-' : '';
  return `${sign}${intPart},${parts[1]} €`;
};

const parseLocaleNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildItemAdditionalsBreakdown = (item: any, finalPrice: number, resolvedQuantity: number) => {
  const additionals = Array.isArray(item?.item_additionals) ? item.item_additionals : [];
  if (additionals.length === 0) {
    return { lines: [], basePrice: finalPrice, additionalsTotal: 0 };
  }

  let runningBasePrice = finalPrice;

  const lines = [...additionals]
    .reverse()
    .map((additional: any) => {
      const cleanName = (additional.name || 'Ajuste')
        .replace(/\s*Ajuste sobre el artículo\s*/gi, '')
        .trim();
      const rawValue = Number(additional?.value || 0);
      const absoluteValue = Math.abs(rawValue);
      const isDiscount = additional?.is_discount === true || rawValue < 0;
      let subtotal = absoluteValue;
      let detail = '';

      if (additional.type === 'percentage') {
        const factor = 1 + (isDiscount ? -absoluteValue : absoluteValue) / 100;
        const baseBeforePercentage = factor !== 0 ? runningBasePrice / factor : runningBasePrice;
        subtotal = Math.abs(runningBasePrice - baseBeforePercentage);
        runningBasePrice = baseBeforePercentage;
        detail = ` (${absoluteValue}%)`;
      } else if (additional.type === 'quantity_multiplier') {
        subtotal = absoluteValue * resolvedQuantity;
        runningBasePrice = isDiscount ? runningBasePrice + subtotal : runningBasePrice - subtotal;
        detail = ` (${fmtEUR(absoluteValue)} × ${resolvedQuantity})`;
      } else if (additional.type === 'capacity_divider') {
        const capacity = Number(additional?.capacity_value || 1) || 1;
        const units = Math.ceil(resolvedQuantity / capacity);
        subtotal = absoluteValue * units;
        runningBasePrice = isDiscount ? runningBasePrice + subtotal : runningBasePrice - subtotal;
        detail = ` (${fmtEUR(absoluteValue)} × ${units})`;
      } else {
        runningBasePrice = isDiscount ? runningBasePrice + subtotal : runningBasePrice - subtotal;
      }

      return {
        cleanName,
        detail,
        isDiscount,
        signedSubtotal: isDiscount ? -subtotal : subtotal,
      };
    })
    .reverse();

  const additionalsTotal = lines.reduce((sum, line) => sum + line.signedSubtotal, 0);

  return {
    lines,
    basePrice: runningBasePrice,
    additionalsTotal,
  };
};

const getDisplayedItemPrice = (item: any): number => {
  if (item?.product_id !== '__CUSTOM_PRODUCT__' || !Array.isArray(item?.prompts)) {
    return Number(item?.price || 0);
  }
  const qtyPrompt = item.prompts.find((prompt: any) => String(prompt?.id || prompt?.name || '').trim() === 'custom_quantity');
  const unitPricePrompt = item.prompts.find((prompt: any) => String(prompt?.id || prompt?.name || '').trim() === 'custom_unit_price');
  // Sin fallback a 1: si no hay cantidad válida, usamos el precio total ya persistido del item.
  const rawQty = qtyPrompt?.value ?? item.quantity;
  const qty = parseLocaleNumber(rawQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return Number(item?.price || 0);
  }
  const unitPrice = parseLocaleNumber(unitPricePrompt?.value);
  return unitPrice > 0 ? unitPrice * qty : Number(item?.price || 0);
};

export default function QuoteDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isHoldedActive, canExportQuotes, canExportQuotesOnSend } = useHoldedIntegration();
  const { membership, isOrgAdmin, isSuperAdmin } = useSubscription();
  const isAdminUser = isSuperAdmin || membership?.role === 'admin';
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const { approveQuote, loading: isApproving } = useQuoteApproval();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [itemDescriptionVisibility, setItemDescriptionVisibility] = useState<Set<string>>(new Set());
  const [itemNotesVisibility, setItemNotesVisibility] = useState<Set<string>>(new Set());
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchQuote(id!),
    enabled: !!id,
  });

  // Portal actions for this quote
  const { data: portalActions } = useQuery({
    queryKey: ['portal-actions', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('quote_portal_actions')
        .select('action, created_at, comment')
        .eq('quote_id', id!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Check if customer has holded_id (needed for Holded exports)
  const { data: customerHoldedId } = useQuery({
    queryKey: ['customer-holded-id', quote?.customer_id],
    queryFn: async () => {
      if (!quote?.customer_id) return null;
      const { data } = await supabase
        .from('customers')
        .select('holded_id')
        .eq('id', quote.customer_id)
        .maybeSingle();
      return data?.holded_id || null;
    },
    enabled: !!quote?.customer_id && canExportQuotes,
    staleTime: 0, // Always refetch to pick up recently imported customers
  });

  // Fetch admin_only prompt settings to filter prompts for non-admin users
  const { data: adminOnlyPrompts } = useQuery({
    queryKey: ['admin-only-prompts', quote?.organization_id],
    queryFn: async () => {
      if (isAdminUser) return new Set<string>(); // Admin sees everything
      
      const { data: orgData } = await supabase
        .from('organizations')
        .select('api_user_id')
        .eq('id', quote!.organization_id)
        .maybeSingle();
      
      if (!orgData?.api_user_id) return new Set<string>();
      
      const { data: settings } = await supabase
        .from('product_prompt_settings')
        .select('easyquote_product_id, prompt_name, label')
        .eq('api_user_id', orgData.api_user_id)
        .eq('admin_only', true);
      
      // Build a Set of "productId:label" for quick lookup
      const hiddenSet = new Set<string>();
      settings?.forEach(s => {
        if (s.label) hiddenSet.add(s.label.trim().toUpperCase());
        if (s.prompt_name) hiddenSet.add(s.prompt_name.trim().toUpperCase());
      });
      return hiddenSet;
    },
    enabled: !!quote?.organization_id && !isAdminUser,
  });

  const isAdminOnlyPrompt = (label: string) => {
    if (isAdminUser || !adminOnlyPrompts) return false;
    return adminOnlyPrompts.has(label.trim().toUpperCase());
  };

  const customerMissingHoldedId = canExportQuotes && !customerHoldedId;

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

  const handleSendEmail = async () => {
    if (!quote?.id || !quote?.customer_id) return;

    setIsSendingEmail(true);
    try {
      // Get customer email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', quote.customer_id)
        .maybeSingle();

      if (!customer?.email) {
        toast.error('El cliente no tiene email configurado. Edítalo primero.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: {
          quoteId: quote.id,
          recipientEmail: customer.email,
          recipientName: customer.name,
        },
      });

      if (error) {
        const errorMsg = data?.error || error.message;
        toast.error(`Error al enviar: ${errorMsg}`);
      } else {
        toast.success(`Presupuesto enviado a ${customer.email}`);
      }
    } catch (error: any) {
      toast.error(`Error al enviar email: ${error.message}`);
    } finally {
      setIsSendingEmail(false);
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

      // Obtener organization_id del sessionStorage
      const organizationId = sessionStorage.getItem('selected_organization_id');

      // Generar nuevo número usando la función RPC estándar, con reintentos ante colisión
      const generateNumber = async (): Promise<string> => {
        if (organizationId) {
          const { data: rpcNumber, error: rpcError } = await supabase
            .rpc('next_document_number', {
              p_organization_id: organizationId,
              p_document_type: 'quote',
            });
          if (rpcError) throw rpcError;
          return typeof rpcNumber === 'string'
            ? rpcNumber
            : (rpcNumber as any)?.document_number ?? '';
        }
        // Fallback legacy
        const year = new Date().getFullYear();
        const { count } = await supabase
          .from('quotes')
          .select('*', { count: 'exact', head: true })
          .like('quote_number', `${year}-%`);
        return `${year}-${String((count || 0) + 1).padStart(4, '0')}`;
      };

      let newQuote: any = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const newNumber = await generateNumber();
        console.log(`Intento ${attempt + 1} - Nuevo número:`, newNumber);

        const { data, error: insertError } = await supabase
          .from('quotes')
          .insert({
            user_id: session.session.user.id,
            quote_number: newNumber,
            customer_id: originalQuote.customer_id,
            title: null,
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

        if (!insertError) {
          newQuote = data;
          break;
        }
        lastError = insertError;
        // 23505 = unique_violation
        if ((insertError as any).code !== '23505') {
          console.error('Error creando nuevo presupuesto:', insertError);
          throw insertError;
        }
        console.warn('Número duplicado, reintentando...', newNumber);
      }
      if (!newQuote) {
        throw lastError ?? new Error('No se pudo generar un número de presupuesto único');
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
      // Block sending/approving if customer has no holded_id and Holded is active
      if ((status === 'sent' && canExportQuotesOnSend && customerMissingHoldedId) || 
          (status === 'approved' && customerMissingHoldedId)) {
        throw new Error('El cliente no está vinculado a Holded. Importa o crea el contacto en Holded primero.');
      }

      const { error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', quoteId);

      if (error) throw error;

      // Export to Holded on 'sent' status only for 'all' mode
      if (status === 'sent' && canExportQuotesOnSend) {
        console.log('🚀 Attempting to export to Holded after status change to sent');
        try {
          const { error: holdedError } = await supabase.functions.invoke('holded-export-estimate', {
            body: { quoteId }
          });
          if (holdedError) {
            console.error('❌ Error exporting to Holded:', holdedError);
            return { holdedError: holdedError.message };
          }
          console.log('✅ Successfully exported to Holded');
        } catch (holdedErr: any) {
          console.error('❌ Error exporting to Holded:', holdedErr);
          return { holdedError: holdedErr.message || 'Error desconocido al exportar a Holded' };
        }
      }
    },
    onSuccess: (result, variables) => {
      const holdedError = result?.holdedError;
      if (variables.status === 'sent' && canExportQuotesOnSend) {
        if (holdedError) {
          toast.warning(`Estado actualizado, pero error al exportar a Holded: ${holdedError}`);
        } else {
          toast.success('Estado actualizado y presupuesto exportado a Holded');
        }
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

  // Comercial solo puede editar/aprobar sus propios presupuestos
  const isOwnQuote = quote?.user_id === membership?.user_id;
  const isComercial = membership?.role === 'comercial';
  
  const isEditable = (quote?.status === 'draft' || quote?.status === 'pending') && 
    (!isComercial || isOwnQuote);
  const canApprove = (membership?.role === 'admin' || membership?.role === 'gestor' || (membership?.role === 'comercial' && isOwnQuote));
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

    if (customerMissingHoldedId) {
      toast.error('El cliente no está vinculado a Holded. Importa o crea el contacto en Holded primero.');
      return;
    }
    
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
                      title="Para aprobar el presupuesto, primero debes cambiarlo a estado 'Preparado'"
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
              {/* Botón editar/duplicar: comercial solo puede editar los suyos */}
              {(!isComercial || isOwnQuote || !isEditable) && (
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
              )}
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
              <Button
                onClick={handleSendEmail}
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={isSendingEmail}
              >
                {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isSendingEmail ? 'Enviando...' : 'Email'}
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
              <div className="mt-0.5 flex items-center gap-2">
                <Badge variant={getStatusVariant(quote.status)}>
                  {statusLabel(quote.status)}
                </Badge>
                {/* Portal activity indicator */}
                {portalActions && portalActions.length > 0 && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Globe className="h-3 w-3" />
                    {portalActions.find(a => a.action === 'approved') ? 'Aprobado vía portal' :
                     portalActions.find(a => a.action === 'rejected') ? 'Rechazado vía portal' :
                     portalActions.find(a => a.action === 'viewed') ? 'Visto en portal' : 'Portal'}
                  </Badge>
                )}
                {/* Action buttons based on current status */}
                {quote.status === 'draft' && (!isComercial || isOwnQuote) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ quoteId: quote.id, status: 'sent' })}
                    disabled={updateStatusMutation.isPending}
                    className="h-6 text-xs px-2"
                  >
                    {canExportQuotesOnSend ? 'Enviar a Holded' : 'Marcar como listo para enviar'}
                  </Button>
                )}
                {quote.status === 'sent' && (!isComercial || isOwnQuote) && (
                  <>
                    {canExportQuotesOnSend && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            toast.info('Reenviando a Holded...');
                            const { data: holdedData, error: holdedError } = await supabase.functions.invoke('holded-export-estimate', {
                              body: { quoteId: quote.id }
                            });
                            if (holdedError) {
                              const realMessage = holdedData?.error || holdedError.message;
                              toast.error(`Error al reenviar a Holded: ${realMessage}`);
                            } else {
                              toast.success('Presupuesto reenviado a Holded correctamente');
                              queryClient.invalidateQueries({ queryKey: ['quote', id] });
                            }
                          } catch (err: any) {
                            toast.error(`Error al reenviar: ${err.message || 'Error desconocido'}`);
                          }
                        }}
                        className="h-6 text-xs px-2"
                      >
                        Reenviar a Holded
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ quoteId: quote.id, status: 'rejected' })}
                      disabled={updateStatusMutation.isPending}
                      className="h-6 text-xs px-2"
                    >
                      Rechazar
                    </Button>
                  </>
                )}
                {quote.status === 'approved' && canExportQuotes && (!isComercial || isOwnQuote) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        toast.info('Reenviando a Holded...');
                        const { data: holdedData, error: holdedError } = await supabase.functions.invoke('holded-export-estimate', {
                          body: { quoteId: quote.id }
                        });
                        if (holdedError) {
                          const realMessage = holdedData?.error || holdedError.message;
                          toast.error(`Error al reenviar a Holded: ${realMessage}`);
                        } else {
                          toast.success('Presupuesto reenviado a Holded correctamente');
                          queryClient.invalidateQueries({ queryKey: ['quote', id] });
                        }
                      } catch (err: any) {
                        toast.error(`Error al reenviar: ${err.message || 'Error desconocido'}`);
                      }
                    }}
                    className="h-6 text-xs px-2"
                  >
                    Reenviar a Holded
                  </Button>
                )}
                {/* Cancel button - available on sent or approved for admin/gestor */}
                {(quote.status === 'sent' || quote.status === 'approved') && 
                  (membership?.role === 'admin' || membership?.role === 'gestor') && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setCancellationReason(''); setShowCancelDialog(true); }}
                    className="h-6 text-xs px-2"
                  >
                    <Ban className="h-3 w-3 mr-1" />
                    Anular
                  </Button>
                )}
                {/* Show cancellation reason if cancelled */}
                {quote.status === 'cancelled' && quote.cancellation_reason && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1">
                    <span className="text-xs text-destructive font-medium">Motivo: </span>
                    <span className="text-xs">{quote.cancellation_reason}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <label className="text-xs font-medium text-muted-foreground">total</label>
              <p className="text-base font-semibold mt-0.5">{fmtEUR(quote.final_price || 0)}</p>
            </div>
            <div className="text-right">
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
                  <p className="text-sm mt-0.5 whitespace-pre-line">{quote.description}</p>
                </div>
              )}
              {quote.notes && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">notas</label>
                  <p className="text-sm mt-0.5 whitespace-pre-line">{quote.notes}</p>
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
                  const approvedState = item.accepted && quote.status === 'approved'
                    ? resolveApprovedQuoteItemState(item)
                    : null;
                  const displayedItemPrice = approvedState?.resolvedPrice ?? getDisplayedItemPrice(item);
                  // Sin fallback artificial a 1: solo usamos cantidad si se puede determinar.
                  // Si no, se muestra el precio total persistido tal cual (sin desglose por cantidad).
                  const strictQty = approvedState?.resolvedQuantity ?? resolveItemQuantityStrict(item);
                  const resolvedQuantity = strictQty ?? 0;
                  const additionalsBreakdown = buildItemAdditionalsBreakdown(item, displayedItemPrice, resolvedQuantity);
                  const multi = item.multi as any;
                  const hasMultipleQuantities = multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1;
                  const itemPrompts = approvedState?.resolvedPromptsObject || (item.prompts && typeof item.prompts === 'object' ? item.prompts : {});
                   const itemOutputs = approvedState?.resolvedOutputs || (Array.isArray(item.outputs) ? item.outputs : []);
                   const compositeData = (item as any).composite_data;
                   const isComposite = compositeData?.components && Object.keys(compositeData.components).length > 0;
                   const isCustomProduct = !item.product_id || item.product_id === '__CUSTOM_PRODUCT__';
                   const hasDetails = isCustomProduct ? !!item.description : (Object.keys(itemPrompts).length > 0 || itemOutputs.length > 0 || isComposite || (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0));
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
                        quote.status === 'approved' 
                          ? (item.accepted ? 'border-r-green-500 bg-green-50/5' : 'border-r-muted opacity-50 bg-muted/20')
                          : (item.accepted ? 'border-r-green-500 bg-green-50/5' : 'border-r-primary')
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
                                {item.name || item.product_name || '-'}
                                {hasMultipleQuantities && (
                                  <span className="text-xs text-muted-foreground ml-2">(cantidad múltiple activada)</span>
                                )}
                              </p>
                              {item.accepted && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                  Aprobado {item.accepted_quantity && `(${item.accepted_quantity})`}
                                </Badge>
                              )}
                              {quote.status === 'approved' && item.accepted === false && (
                                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                                  No aprobado
                                </Badge>
                              )}
                              {item.description && (
                                <Button
                                  variant={itemDescriptionVisibility.has(String(item.id ?? index)) ? "secondary" : "ghost"}
                                  size="sm"
                                  className="h-6 px-2 gap-1 text-xs text-muted-foreground"
                                  onClick={() => {
                                    const key = String(item.id ?? index);
                                    setItemDescriptionVisibility((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(key)) next.delete(key);
                                      else next.add(key);
                                      return next;
                                    });
                                  }}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Ver descripción
                                  {itemDescriptionVisibility.has(String(item.id ?? index)) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                              )}
                              {hasDetails && (
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className={`h-6 p-0 ${quote.status === 'approved' ? 'px-2 gap-1 text-xs text-muted-foreground' : 'w-6'}`}>
                                    {quote.status === 'approved' && !isExpanded && (
                                      <>
                                        <Eye className="h-3.5 w-3.5" />
                                        Ver detalles
                                      </>
                                    )}
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                            </div>
                            
                            {itemDescriptionVisibility.has(String(item.id ?? index)) && (approvedState?.resolvedDescription || item.description) && (
                              <div className="mt-2 rounded-md bg-muted/50 px-3 py-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1">descripción del artículo</p>
                                 <p className="text-sm whitespace-pre-line">{approvedState?.resolvedDescription || item.description}</p>
                              </div>
                            )}

                            {/* Resumen de prompts en vista colapsada */}
                            {!isExpanded && Object.keys(itemPrompts).length > 0 && (() => {
                              const summaryPrompts = Object.entries(itemPrompts)
                                .filter(([key, promptData]: [string, any]) => {
                                  const value = typeof promptData === 'object' ? promptData.value : promptData;
                                  if (!value || value === '' || value === null) return false;
                                  if (typeof value === 'object') return false;
                                  if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('#'))) return false;
                                  const hasLabel = typeof promptData === 'object' && promptData.label && promptData.label.trim() !== '';
                                  return hasLabel;
                                })
                                .sort(([, a]: [string, any], [, b]: [string, any]) => (a.order ?? 999) - (b.order ?? 999))
                                .slice(0, 3); // Solo mostrar los primeros 3 prompts en resumen

                              if (summaryPrompts.length === 0) return null;

                              // No mostrar resumen - solo se ve al expandir
                              return null;
                            })()}
                            
                            {/* Quantity selector for items with multiple quantities */}
                            {hasMultipleQuantities && isApprovable && !item.accepted && selectedItems.has(item.id) && (
                              <div className="mt-2 flex items-center gap-2">
                                <label className="text-xs font-medium text-muted-foreground">Selecciona cantidad:</label>
                                <Select
                                  value={itemQuantities[item.id]?.toString() || ''}
                                  onValueChange={(value) => {
                                    // Parse Spanish-formatted numbers (e.g., "1.000" → 1000)
                                    const parsed = Number(String(value).replace(/\./g, '').replace(',', '.'));
                                    setItemQuantities(prev => ({
                                      ...prev,
                                      [item.id]: Number.isFinite(parsed) ? parsed : parseInt(value)
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
                            
                            {/* Display all multi-quantity rows after approval, highlighting the selected one */}
                            {hasMultipleQuantities && quote.status === 'approved' && item.accepted && item.accepted_quantity && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Cantidades presupuestadas:</p>
                                {multi.rows
                                  .filter((row: any) => {
                                    const qty = row.qty || row.quantity;
                                    return qty != null && qty !== '' && qty !== 0 && qty !== '0';
                                  })
                                  .map((row: any, idx: number) => {
                                    const qty = row.qty || row.quantity;
                                    const rowPrice = parseFloat(row.outs?.find((o: any) => o.type === 'Price')?.value || row.price || 0);
                                    const isApproved = Number(qty) === Number(item.accepted_quantity);
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`flex items-center justify-between text-xs px-2 py-1 rounded border ${
                                          isApproved 
                                            ? 'bg-green-500/10 border-green-500/30 text-foreground font-medium' 
                                            : 'bg-muted/30 border-transparent text-muted-foreground opacity-50 line-through'
                                        }`}
                                      >
                                        <span>{qty} uds.</span>
                                        <span>{fmtEUR(rowPrice)}</span>
                                        {isApproved && (
                                          <Badge variant="outline" className="text-[10px] h-4 bg-green-500/10 text-green-600 border-green-500/20 ml-1">
                                            Aprobada
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                            
                            {/* Collapsible details */}
                            <CollapsibleContent className="mt-2 space-y-0.5">
                              {/* Descripción y cantidad para productos personalizados */}
                              {isCustomProduct && (
                                <>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                  )}
                                  {(() => {
                                    const prompts = Array.isArray(item.prompts) ? item.prompts : [];
                                    const cantidadPrompt = prompts.find((p: any) => p.label?.toLowerCase() === 'cantidad');
                                    if (cantidadPrompt?.value) {
                                      return (
                                        <p className="text-xs">
                                          <span className="font-medium text-muted-foreground">Cantidad:</span>{' '}
                                          <span className="text-foreground">{cantidadPrompt.value}</span>
                                        </p>
                                      );
                                    }
                                    return null;
                                  })()}
                                </>
                              )}
                              {/* Prompts para productos API */}
                              {!isCustomProduct && Object.keys(itemPrompts).length > 0 && (() => {
                                const visiblePrompts = Object.entries(itemPrompts)
                                  .filter(([key, promptData]: [string, any]) => {
                                    const value = typeof promptData === 'object' ? promptData.value : promptData;
                                    
                                    if (!value || value === '' || value === null) return false;
                                    if (typeof value === 'object') return false;
                                    if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('#'))) return false;
                                    
                                    const hasLabel = typeof promptData === 'object' && promptData.label && promptData.label.trim() !== '';
                                    if (!hasLabel) return false;
                                    
                                    // Filter admin_only prompts for non-admin users
                                    const label = typeof promptData === 'object' ? promptData.label : key;
                                    if (isAdminOnlyPrompt(label)) return false;
                                    
                                    return true;
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

                              {/* Outputs del producto */}
                              {itemOutputs.length > 0 && (() => {
                                const visibleOutputs = itemOutputs.filter((o: any) => {
                                  if (!o.name || o.type === 'Price') return false;
                                  const val = o.value;
                                  if (val === null || val === undefined || val === '' || val === '0' || val === 0) return false;
                                  return true;
                                });
                                if (visibleOutputs.length === 0) return null;
                                return (
                                  <div className="pt-1 mt-1 border-t border-border/50">
                                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Resultados:</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5">
                                      {visibleOutputs.map((output: any, idx: number) => (
                                        <div key={idx} className="text-xs">
                                          <span className="font-medium text-muted-foreground">{output.name}:</span>{' '}
                                          <span className="text-foreground">{output.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Componentes del producto compuesto */}
                              {isComposite && (() => {
                                const componentEntries = Object.entries(compositeData.components || {});
                                if (componentEntries.length === 0) return null;
                                return (
                                  <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground">Componentes:</p>
                                    {componentEntries.map(([compKey, compData]: [string, any]) => {
                                      const alias = compData.alias || compKey.split(':')[0] || 'Componente';
                                      const compPrompts = Array.isArray(compData.prompts) ? compData.prompts : [];
                                      const compOutputs = Array.isArray(compData.outputs) ? compData.outputs : [];
                                      const compPrice = compData.price;
                                      
                                      const visibleCompPrompts = compPrompts.filter((p: any) => {
                                        const val = p.currentValue;
                                        if (!val || val === '' || val === null) return false;
                                        if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('#'))) return false;
                                        return true;
                                      }).sort((a: any, b: any) => (a.promptSequence ?? 999) - (b.promptSequence ?? 999));
                                      
                                      const visibleCompOutputs = compOutputs.filter((o: any) => {
                                        if (!o.name || o.type === 'Price') return false;
                                        const val = o.value;
                                        if (val === null || val === undefined || val === '' || val === '0' || val === 0) return false;
                                        return true;
                                      });

                                      return (
                                        <div key={compKey} className="bg-muted/30 rounded-md p-2 space-y-1">
                                          <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-foreground">{alias}</p>
                                            {compPrice != null && compPrice !== 0 && (
                                              <span className="text-xs font-medium text-primary">{fmtEUR(compPrice)}</span>
                                            )}
                                          </div>
                                          {visibleCompPrompts.length > 0 && (
                                            <div className="space-y-0.5">
                                              {visibleCompPrompts.map((p: any, idx: number) => (
                                                <div key={idx} className="text-xs">
                                                  <span className="font-medium text-muted-foreground">{p.promptText || p.label || `Prompt ${p.promptSequence}`}:</span>{' '}
                                                  <span className="text-foreground">{String(p.currentValue)}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {visibleCompOutputs.length > 0 && (
                                            <div className="pt-0.5">
                                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Resultados</p>
                                              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5">
                                                {visibleCompOutputs.map((o: any, idx: number) => (
                                                  <div key={idx} className="text-xs">
                                                    <span className="font-medium text-muted-foreground">{o.name}:</span>{' '}
                                                    <span className="text-foreground">{o.value}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}

                              {additionalsBreakdown.lines.length > 0 && (
                                <div className="pt-1 mt-1 border-t border-border/50">
                                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Ajustes incluidos en el total:</p>
                                  {additionalsBreakdown.lines.map((additional, idx: number) => {
                                    return (
                                      <div key={idx} className="text-xs flex justify-between">
                                        <span className={additional.isDiscount ? 'text-green-600' : 'text-muted-foreground'}>{additional.cleanName}{additional.detail}</span>
                                        <span className={additional.isDiscount ? 'text-green-600 font-medium' : 'font-medium'}>
                                          {fmtEUR(additional.signedSubtotal)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  <div className="mt-1 pt-1 border-t border-border/50 space-y-0.5">
                                    <div className="text-xs flex justify-between text-muted-foreground">
                                      <span>Base del artículo</span>
                                      <span>{fmtEUR(additionalsBreakdown.basePrice)}</span>
                                    </div>
                                    <div className="text-xs flex justify-between text-muted-foreground">
                                      <span>Total ajustes</span>
                                      <span>{fmtEUR(additionalsBreakdown.additionalsTotal)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CollapsibleContent>
                          </div>
                            <div className="text-right">
                              <p className="text-base font-semibold text-primary">{fmtEUR(displayedItemPrice)}</p>
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

      {/* Document Attachments */}
      {quote?.id && (
        <DocumentAttachments
          quoteId={quote.id}
          organizationId={sessionStorage.getItem('selected_organization_id') || ''}
          holdedDocumentId={quote.holded_id || quote.holded_estimate_id || undefined}
          holdedDocType="estimate"
        />
      )}

      {/* Cancellation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular presupuesto</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo de la anulación de este presupuesto. Esta información quedará registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="quote-cancellation-reason" className="text-sm font-medium">
              Motivo de anulación *
            </Label>
            <Textarea
              id="quote-cancellation-reason"
              placeholder="Ej: Cliente canceló el proyecto, presupuesto caducado..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancellationReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!id || !cancellationReason.trim()) return;
                const { error } = await supabase
                  .from('quotes')
                  .update({ status: 'cancelled', cancellation_reason: cancellationReason.trim() })
                  .eq('id', id);
                if (error) {
                  toast.error('Error al anular el presupuesto');
                } else {
                  toast.success('Presupuesto anulado');
                  queryClient.invalidateQueries({ queryKey: ['quote', id] });
                  setShowCancelDialog(false);
                }
              }}
            >
              Confirmar anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}