import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Download, ChevronDown, Edit, FileText, LayoutGrid, Wrench, ShieldAlert, RefreshCw, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useSalesOrders, SalesOrder, SalesOrderItem, SalesOrderAdditional } from "@/hooks/useSalesOrders";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CustomerName } from "@/components/quotes/CustomerName";
import { isVisiblePrompt, type PromptDef } from "@/utils/promptVisibility";
import { ItemProductionCard } from "@/components/production/ItemProductionCard";
import { WorkOrderItem } from "@/components/production/WorkOrderItem";
import { ImpositionSection } from "@/components/production/ImpositionSection";
import { useOutputTypeVisibility } from "@/hooks/useOutputTypeVisibility";

import { generateWorkOrderPDF } from "@/utils/workOrderPdfGenerator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import DocumentAttachments from "@/components/quotes/DocumentAttachments";

const statusColors = {
  draft: "outline",
  pending: "default",
  in_production: "secondary",
  completed: "default",
  cancelled: "destructive",
} as const;

const statusLabels = {
  draft: "Borrador",
  pending: "Pendiente",
  in_production: "En Producción",
  completed: "Completado",
  cancelled: "Anulado",
};

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

const SalesOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { canAccessProduccion, membership } = useSubscription();
  const canViewProduction = canAccessProduccion();
  const { loading, fetchSalesOrderById, fetchSalesOrderItems, fetchSalesOrderAdditionals, updateSalesOrderStatus, updateSalesOrderItem, deleteSalesOrder } = useSalesOrders();
  const { isVisibleIn } = useOutputTypeVisibility();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [additionals, setAdditionals] = useState<SalesOrderAdditional[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isUpdatingHolded, setIsUpdatingHolded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [viewMode, setViewMode] = useState<'production' | 'administrative'>('production');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sourceQuoteNumber, setSourceQuoteNumber] = useState<string | null>(null);
  const [adminOnlyPrompts, setAdminOnlyPrompts] = useState<Set<string>>(new Set());
  const [customerInfo, setCustomerInfo] = useState<{ name: string; email?: string; phone?: string }>({ name: 'Sin cliente' });
  const { isHoldedActive } = useHoldedIntegration();
  // Edit confirmation dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editConsent, setEditConsent] = useState(false);
  // Cancellation dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  // Item notes dialog state
  const [notesDialogItem, setNotesDialogItem] = useState<SalesOrderItem | null>(null);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!canViewProduction) {
      navigate("/");
      return;
    }
    loadUserRole();
    if (id) {
      loadOrderData();
    }
  }, [id, canViewProduction, navigate]);

  const loadUserRole = async () => {
    const { data: roleData } = await supabase.rpc('get_current_user_role').single();
    if (roleData) {
      setUserRole(roleData.role);
      // Comercial solo ve vista administrativa
      if (roleData.role === 'comercial') {
        setViewMode('administrative');
      }
      // Always load admin_only prompts (needed for production view filtering)
      if (roleData.organization_id) {
        loadAdminOnlyPrompts(roleData.organization_id);
      }
    }
  };

  const loadAdminOnlyPrompts = async (organizationId: string) => {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_user_id')
      .eq('id', organizationId)
      .maybeSingle();
    
    if (!orgData?.api_user_id) return;
    
    const { data: settings } = await supabase
      .from('product_prompt_settings')
      .select('prompt_name, label')
      .eq('api_user_id', orgData.api_user_id)
      .eq('admin_only', true);
    
    const hiddenSet = new Set<string>();
    settings?.forEach(s => {
      if (s.label) hiddenSet.add(s.label.trim().toUpperCase());
      if (s.prompt_name) hiddenSet.add(s.prompt_name.trim().toUpperCase());
    });
    setAdminOnlyPrompts(hiddenSet);
  };

  const isAdminOnlyPrompt = (label: string) => {
    if (userRole === 'admin' || adminOnlyPrompts.size === 0) return false;
    return adminOnlyPrompts.has(label.trim().toUpperCase());
  };

  // Refresh output types from EasyQuote pricing API for stored items
  const refreshOutputTypes = async (itemsData: SalesOrderItem[]): Promise<SalesOrderItem[]> => {
    try {
      const token = sessionStorage.getItem("easyquote_token");
      console.log('[RefreshOutputTypes] Starting... token available:', !!token, 'items:', itemsData.length);
      if (!token) return itemsData;

      // Get unique product_ids
      const productIds = [...new Set(itemsData.filter(i => i.product_id).map(i => i.product_id!))];
      if (productIds.length === 0) return itemsData;

      // Fetch current output types via easyquote-pricing GET (returns resolved names + types)
      const outputMaps = new Map<string, Map<string, string>>(); // productId -> (outputName -> outputType)
      await Promise.all(productIds.map(async (productId) => {
        try {
          const { data, error } = await supabase.functions.invoke("easyquote-pricing", {
            body: { token, productId, inputs: [] },
          });
          if (error || data?.error) {
            console.warn(`[RefreshOutputTypes] Pricing failed for ${productId}:`, error || data?.error);
            return;
          }
          // Extract outputs from pricing response (outputValues or outputs)
          const outputs = data?.outputValues || data?.outputs || [];
          if (Array.isArray(outputs) && outputs.length > 0) {
            const nameToType = new Map<string, string>();
            outputs.forEach((o: any) => {
              const name = o.label || o.name || o.outputText || o.text || o.outputName || '';
              const type = o.outputType || o.type || '';
              if (name && type) nameToType.set(name, type);
            });
            console.log(`[RefreshOutputTypes] Product ${productId}: ${nameToType.size} outputs resolved`, Object.fromEntries(nameToType));
            outputMaps.set(productId, nameToType);
          }
        } catch (err) {
          console.warn(`[RefreshOutputTypes] Failed for product ${productId}:`, err);
        }
      }));

      if (outputMaps.size === 0) return itemsData;

      // Update output types in items
      const updatedItems: SalesOrderItem[] = [];
      const dbUpdates: { itemId: string; outputs: any[] }[] = [];

      for (const item of itemsData) {
        if (!item.product_id || !item.outputs || !Array.isArray(item.outputs) || !outputMaps.has(item.product_id)) {
          updatedItems.push(item);
          continue;
        }

        const nameToType = outputMaps.get(item.product_id)!;
        let changed = false;
        const newOutputs = (item.outputs as any[]).map((o: any) => {
          const currentType = nameToType.get(o.name);
          if (currentType && currentType !== o.type) {
            console.log(`[RefreshOutputTypes] Updating "${o.name}": ${o.type} → ${currentType}`);
            changed = true;
            return { ...o, type: currentType };
          }
          return o;
        });

        if (changed) {
          updatedItems.push({ ...item, outputs: newOutputs as any });
          dbUpdates.push({ itemId: item.id, outputs: newOutputs });
        } else {
          updatedItems.push(item);
        }
      }

      // Persist changes to DB in background
      if (dbUpdates.length > 0) {
        console.log(`[RefreshOutputTypes] Updating ${dbUpdates.length} items with corrected output types`);
        Promise.all(dbUpdates.map(({ itemId, outputs }) =>
          supabase.from('sales_order_items').update({ outputs }).eq('id', itemId)
        )).catch(err => console.warn('[RefreshOutputTypes] DB update failed:', err));
      } else {
        console.log('[RefreshOutputTypes] No type changes detected');
      }

      return updatedItems;
    } catch (err) {
      console.warn('[RefreshOutputTypes] Error:', err);
      return itemsData;
    }
  };

  const loadOrderData = async () => {
    if (!id) return;
    const orderData = await fetchSalesOrderById(id);
    setOrder(orderData);
    
    if (orderData) {
      let itemsData = await fetchSalesOrderItems(id);
      
      // Backfill composite_data from accepted quote_items if missing
      if (orderData.quote_id && itemsData.some(i => !i.composite_data)) {
        const itemsMissingComposite = itemsData.filter(i => !i.composite_data);
        const { data: quoteItems } = await supabase
          .from('quote_items')
          .select('product_id, position, composite_data')
          .eq('quote_id', orderData.quote_id)
          .eq('accepted', true)
          .not('composite_data', 'is', null);
        
        if (quoteItems && quoteItems.length > 0) {
          const dbUpdates: { id: string; composite_data: any }[] = [];
          itemsData = itemsData.map(item => {
            if (item.composite_data) return item;
            const match = quoteItems.find(qi => 
              qi.product_id === item.product_id && qi.position === item.position
            );
            if (match?.composite_data) {
              dbUpdates.push({ id: item.id, composite_data: match.composite_data });
              return { ...item, composite_data: match.composite_data as any };
            }
            return item;
          });
          // Persist in background
          if (dbUpdates.length > 0) {
            console.log(`[Backfill] Copying composite_data for ${dbUpdates.length} items`);
            Promise.all(dbUpdates.map(u =>
              supabase.from('sales_order_items').update({ composite_data: u.composite_data }).eq('id', u.id)
            )).catch(err => console.warn('[Backfill] DB update failed:', err));
          }
        }
      }
      
      // Backfill imposition_data for items missing it but with has_imposition enabled
      const itemsMissingImposition = itemsData.filter(i => i.product_id && !i.imposition_data);
      if (itemsMissingImposition.length > 0) {
        try {
          const organizationId = sessionStorage.getItem('selected_organization_id');
          if (organizationId) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('api_user_id')
              .eq('id', organizationId)
              .maybeSingle();
            
            if (orgData?.api_user_id) {
              const apiUserId = orgData.api_user_id;

              // Collect ALL product IDs: top-level + component products from composite_data
              const allProductIds = new Set<string>();
              for (const item of itemsMissingImposition) {
                if (item.product_id) allProductIds.add(item.product_id);
                const cd = (item as any).composite_data;
                if (cd?.activeComponents) {
                  for (const ac of cd.activeComponents) {
                    if (ac.component_product_id) allProductIds.add(ac.component_product_id);
                  }
                }
              }

              // Batch fetch product settings for ALL products (simple + component)
              const { data: allSettings } = await supabase
                .from('product_component_settings')
                .select('easyquote_product_id, has_imposition')
                .eq('api_user_id', apiUserId)
                .in('easyquote_product_id', [...allProductIds])
                .eq('has_imposition', true);
              
              const productsWithImposition = new Set(allSettings?.map(s => s.easyquote_product_id) || []);
              
              if (productsWithImposition.size > 0) {
                // Get all orgs sharing the same api_user_id (cross-org mapping fallback)
                const { data: siblingOrgs } = await supabase
                  .from('organizations')
                  .select('id')
                  .eq('api_user_id', apiUserId);
                const allOrgIds = siblingOrgs?.map(o => o.id) || [organizationId];

                // Fetch all variable mappings and labels for these products
                const [mappingsResult, labelsResult] = await Promise.all([
                  supabase
                    .from('product_variable_mappings')
                    .select(`
                      easyquote_product_id,
                      prompt_or_output_name,
                      production_variable_id,
                      production_variables (
                        imposition_field,
                        default_value
                      )
                    `)
                    .in('easyquote_product_id', [...productsWithImposition])
                    .in('organization_id', allOrgIds),
                  supabase
                    .from('product_prompt_settings')
                    .select('easyquote_product_id, prompt_name, label')
                    .in('easyquote_product_id', [...productsWithImposition])
                    .eq('api_user_id', apiUserId),
                ]);

                const allMappings = mappingsResult.data || [];
                const allLabels = labelsResult.data || [];

                // Build per-product cell→label lookup
                const labelsByProduct: Record<string, Record<string, string>> = {};
                for (const row of allLabels) {
                  if (!row.easyquote_product_id || !row.prompt_name || !row.label) continue;
                  if (!labelsByProduct[row.easyquote_product_id]) labelsByProduct[row.easyquote_product_id] = {};
                  labelsByProduct[row.easyquote_product_id][row.prompt_name] = row.label;
                }

                const { updateCalculatedValues } = await import("@/utils/impositionCalculator");

                const resolveForProductAsync = (productId: string, prompts: any[], outputs: any[]) => {
                  if (!productsWithImposition.has(productId)) return null;
                  const mappings = allMappings.filter(
                    (m: any) => m.easyquote_product_id === productId && m.production_variables?.imposition_field
                  );
                  if (mappings.length === 0) return null;

                  const cellToLabel = labelsByProduct[productId] || {};
                  const impositionData: Record<string, number> = {
                    productWidth: 210, productHeight: 297, bleed: 0,
                    validWidth: 680, validHeight: 480, gutterH: 0, gutterV: 0,
                  };

                  for (const mapping of mappings) {
                    const variable = mapping.production_variables as any;
                    const field = variable.imposition_field;
                    const cellName = mapping.prompt_or_output_name;
                    const displayName = cellToLabel[cellName] || cellName;
                    const promptMatch = prompts.find((p: any) => p.label === cellName || p.label === displayName);
                    const outputMatch = outputs.find((o: any) => o.name === cellName || o.name === displayName);
                    const rawValue = promptMatch?.value ?? outputMatch?.value ?? variable.default_value;
                    if (rawValue !== undefined && rawValue !== null) {
                      const numValue = parseFloat(String(rawValue));
                      if (!isNaN(numValue) && numValue >= 0) {
                        impositionData[field] = numValue;
                      }
                    }
                  }
                  return updateCalculatedValues(impositionData as any);
                };

                const impUpdates: { id: string; imposition_data: any; observations: any[] }[] = [];
                
                for (const item of itemsMissingImposition) {
                  const compositeData = (item as any).composite_data;
                  const isComposite = compositeData?.components && Object.keys(compositeData.components).length > 0;

                  if (isComposite) {
                    // Composite: resolve per component
                    const impositionMap: Record<string, any> = {};
                    const activeComponents = compositeData.activeComponents || [];

                    for (const [compKey, compData] of Object.entries(compositeData.components as Record<string, any>)) {
                      const activeComp = activeComponents.find((ac: any) => {
                        const key = `${ac.id}:${ac.instance_index || 1}`;
                        return key === compKey;
                      });
                      const compProductId = activeComp?.component_product_id;
                      if (!compProductId) continue;

                      const compPrompts = Array.isArray(compData.prompts)
                        ? compData.prompts.map((p: any) => ({
                            label: p.promptText || p.label || '',
                            value: p.currentValue ?? p.value,
                          }))
                        : [];
                      const compOutputs = Array.isArray(compData.outputs) ? compData.outputs : [];

                      const resolved = resolveForProductAsync(compProductId, compPrompts, compOutputs);
                      if (resolved) impositionMap[compKey] = resolved;
                    }

                    if (Object.keys(impositionMap).length > 0) {
                      impUpdates.push({
                        id: item.id,
                        imposition_data: impositionMap,
                        observations: [{
                          type: "imposition_auto",
                          message: "Imposición calculada automáticamente (backfill compuesto)",
                          timestamp: new Date().toISOString(),
                        }],
                      });
                    }
                  } else {
                    // Simple product
                    const resolved = resolveForProductAsync(item.product_id!, (item.prompts as any[]) || [], (item.outputs as any[]) || []);
                    if (resolved) {
                      impUpdates.push({
                        id: item.id,
                        imposition_data: resolved,
                        observations: [{
                          type: "imposition_auto",
                          message: "Imposición calculada automáticamente (backfill)",
                          timestamp: new Date().toISOString(),
                        }],
                      });
                    }
                  }
                }
                
                if (impUpdates.length > 0) {
                  console.log(`[Backfill] Calculating imposition for ${impUpdates.length} items`);
                  itemsData = itemsData.map(item => {
                    const update = impUpdates.find(u => u.id === item.id);
                    if (update) {
                      return { ...item, imposition_data: update.imposition_data as any };
                    }
                    return item;
                  });
                  // Persist in background
                  Promise.all(impUpdates.map(u =>
                    supabase.from('sales_order_items').update({
                      imposition_data: JSON.parse(JSON.stringify(u.imposition_data)),
                      observations: u.observations as any,
                    }).eq('id', u.id)
                  )).catch(err => console.warn('[Backfill] Imposition DB update failed:', err));
                }
              }
            }
          }
        } catch (impErr) {
          console.warn('[Backfill] Imposition calculation error:', impErr);
        }
      }
      
      setItems(itemsData);
      
      const additionalsData = await fetchSalesOrderAdditionals(id);
      setAdditionals(additionalsData);

      // Load customer info
      if (orderData.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name, email, phone')
          .eq('id', orderData.customer_id)
          .single();
        if (customer) {
          setCustomerInfo({ name: customer.name, email: customer.email || undefined, phone: customer.phone || undefined });
        }
      }
      
      // Load source quote number if exists
      if (orderData.quote_id) {
        const { data: quoteData } = await supabase
          .from('quotes')
          .select('quote_number')
          .eq('id', orderData.quote_id)
          .single();
        if (quoteData) {
          setSourceQuoteNumber(quoteData.quote_number);
        }
      }
      
      // Auto-sync Holded number if missing
      if (orderData.holded_document_id && !orderData.holded_document_number) {
        syncOrderNumber();
      }
    }
  };

  const syncOrderNumber = async () => {
    if (!id || !order?.holded_document_id) return;
    
    setIsSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-sync-order-number',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ orderId: id })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al sincronizar');
      }

      if (result.holdedNumber) {
        setOrder(prev => prev ? { ...prev, holded_document_number: result.holdedNumber } : null);
        toast.success('Número de Holded sincronizado');
      }
    } catch (error: any) {
      console.error('Error syncing order number:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusChange = async (newStatus: SalesOrder['status']) => {
    if (!id || !order) return;
    
    // If cancelling, show cancellation reason dialog
    if (newStatus === 'cancelled') {
      setCancellationReason('');
      setShowCancelDialog(true);
      return;
    }
    
    // Validar que todos los artículos estén completados antes de marcar el pedido como completado
    if (newStatus === 'completed') {
      const incompleteItems = items.filter(item => item.production_status !== 'completed');
      if (incompleteItems.length > 0) {
        toast.error(`No se puede completar el pedido. Hay ${incompleteItems.length} artículo(s) sin terminar.`);
        return;
      }
    }
    
    // If changing to pending, export to Holded automatically if integration is active
    if (newStatus === 'pending' && order.status !== 'pending' && isHoldedActive && !order.holded_document_id) {
      const success = await updateSalesOrderStatus(id, newStatus);
      if (success) {
        setOrder(prev => prev ? { ...prev, status: newStatus } : null);
        // Automatically export to Holded
        await handleExportToHolded();
      }
    } else {
      const success = await updateSalesOrderStatus(id, newStatus);
      if (success) {
        setOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    }
  };

  const handleConfirmCancellation = async () => {
    if (!id || !order) return;
    if (!cancellationReason.trim()) {
      toast.error('Debes indicar el motivo de la anulación');
      return;
    }
    
    // Update status and cancellation reason
    const { error } = await supabase
      .from('sales_orders')
      .update({ status: 'cancelled', cancellation_reason: cancellationReason.trim() })
      .eq('id', id);
    
    if (error) {
      toast.error('Error al anular el pedido');
      return;
    }
    
    toast.success('Pedido anulado');
    setOrder(prev => prev ? { ...prev, status: 'cancelled', cancellation_reason: cancellationReason.trim() } : null);
    setShowCancelDialog(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    const success = await deleteSalesOrder(id);
    if (success) {
      navigate("/pedidos");
    }
  };

  const handleExportToHolded = async () => {
    if (!id || !order) return;
    
    // Validar que el pedido tenga un cliente asignado
    if (!order.customer_id) {
      toast.error('El pedido debe tener un cliente asignado para exportar a Holded');
      return;
    }
    
    setIsExporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('No hay sesión activa');
        return;
      }

      toast.loading('Exportando a Holded...');

      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-export-order',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ orderId: id })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al exportar a Holded');
      }

      toast.success('Pedido exportado a Holded correctamente');
      
      // Reload to get the holded_document_id
      await loadOrderData();
    } catch (error: any) {
      console.error('Error exporting to Holded:', error);
      toast.error(error.message || 'Error al exportar a Holded');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateInHolded = async () => {
    if (!id || !order?.holded_document_id) return;
    
    setIsUpdatingHolded(true);
    const toastId = toast.loading('Actualizando en Holded...');
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.dismiss(toastId);
        toast.error('No hay sesión activa');
        return;
      }

      const response = await fetch(
        `https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-update-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ orderId: id })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar en Holded');
      }

      toast.dismiss(toastId);
      toast.success('Pedido actualizado en Holded correctamente');
    } catch (error: any) {
      console.error('Error updating in Holded:', error);
      toast.dismiss(toastId);
      toast.error(error.message || 'Error al actualizar en Holded');
    } finally {
      setIsUpdatingHolded(false);
    }
  };

  const handleDownloadHoldedPdf = async () => {
    if (!order?.holded_document_id) return;

    const toastId = toast.loading('Descargando PDF...');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.dismiss(toastId);
        toast.error('No hay sesión activa');
        return;
      }

      const organizationId = sessionStorage.getItem('selected_organization_id');
      
      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-download-pdf',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ 
            holdedDocumentId: order.holded_document_id,
            documentType: 'salesorder',
            organization_id: organizationId
          })
        }
      );

      if (!response.ok) {
        throw new Error('Error al descargar el PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedido-${order.holded_document_number || order.order_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss(toastId);
      toast.success('PDF descargado correctamente');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.dismiss(toastId);
      toast.error('Error al descargar el PDF');
    }
  };

  const handleSyncHoldedNumber = async () => {
    if (!id || !order?.holded_document_id) {
      toast.error('No se puede sincronizar este pedido');
      return;
    }

    try {
      setIsSyncing(true);
      toast.loading('Sincronizando número de Holded...');

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('No hay sesión activa');
        return;
      }

      const response = await fetch(
        'https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/holded-sync-order-number',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({ orderId: id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al sincronizar');
      }

      setOrder(prev => prev ? { ...prev, holded_document_number: data.holdedNumber } : null);
      toast.success(`Número sincronizado: ${data.holdedNumber}`);
    } catch (error: any) {
      console.error('Error syncing Holded number:', error);
      toast.error(error.message || 'Error al sincronizar el número de Holded');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!order || items.length === 0) return;

    setIsGeneratingPDF(true);
    try {
      // Get customer name
      let customerName = 'Sin cliente';
      if (order.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name')
          .eq('id', order.customer_id)
          .single();
        if (customer) customerName = customer.name;
      }

      await generateWorkOrderPDF({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName,
        orderDate: format(new Date(order.order_date), 'dd/MM/yyyy', { locale: es }),
        deliveryDate: order.delivery_date 
          ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
          : undefined,
        items: items.map((item) => {
          const allOutputs = (item.outputs && Array.isArray(item.outputs) ? item.outputs : []) as Array<{ name: string; type: string; value: any }>;
          const filteredOutputs = allOutputs.filter(o => isVisibleIn(o.type, 'production'));
          return {
            id: item.id,
            product_name: item.product_name,
            product_id: item.product_id || undefined,
            quantity: item.quantity,
            prompts: item.prompts as any,
            outputs: filteredOutputs,
            description: item.description || undefined,
            imposition_data: item.imposition_data as any,
            composite_data: (item as any).composite_data || undefined,
          };
        }),
        additionals: additionals.map(a => ({
          name: a.name,
          type: a.type,
          value: a.value,
          is_discount: a.is_discount,
        })),
      });
      
      toast.success('PDF de Orden de Trabajo generado correctamente');
    } catch (error) {
      console.error('Error generating work order PDF:', error);
      toast.error('Error al generar el PDF de Orden de Trabajo');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!canAccessProduccion()) {
    return null;
  }

  if (loading || !order) {
    return (
      <div className={isMobile ? "p-3" : "container mx-auto py-6"}>
        <div className="text-center py-8">Cargando pedido...</div>
      </div>
    );
  }

  return (
    <div className={isMobile ? "p-0 md:p-2 space-y-3" : "container mx-auto py-2 space-y-3"}>
      {/* Header */}
      <Card className={isMobile ? "rounded-none" : ""}>
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3`}>
            <div className="flex items-center gap-3 flex-1">
              <div>
                <CardTitle className={isMobile ? "text-base" : "text-lg"}>
                  Pedido {order.order_number}
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Fecha: {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: es })}
                </CardDescription>
              </div>
              
              {/* Toggle de vistas - oculto para comerciales */}
              {userRole !== 'comercial' && !isMobile && (
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'production' | 'administrative')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="production" className="gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Producción</span>
                    </TabsTrigger>
                    <TabsTrigger value="administrative" className="gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Admin</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            
            {/* Botones de acción - grid en móvil */}
            <div className={`flex ${isMobile ? 'flex-wrap' : ''} gap-2`}>
              <Button 
                onClick={() => navigate("/pedidos")}
                size={isMobile ? "default" : "sm"}
                variant="outline"
                className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
              >
                <ArrowLeft className="h-4 w-4" />
                {!isMobile && "Volver"}
              </Button>
              {order.holded_document_id && viewMode === 'administrative' && (
                <Button 
                  onClick={handleDownloadHoldedPdf}
                  size={isMobile ? "default" : "sm"}
                  variant="outline"
                  className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                >
                  <Download className="h-4 w-4" />
                  {!isMobile && "PDF Holded"}
                </Button>
              )}
              {order.holded_document_id && viewMode === 'administrative' && userRole === 'admin' && (
                <Button 
                  onClick={handleUpdateInHolded}
                  size={isMobile ? "default" : "sm"}
                  variant="outline"
                  className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                  disabled={isUpdatingHolded}
                >
                  <RefreshCw className={`h-4 w-4 ${isUpdatingHolded ? 'animate-spin' : ''}`} />
                  {!isMobile && "Actualizar en Holded"}
                </Button>
              )}
              {viewMode === 'production' && (
                <Button 
                  onClick={handleGeneratePDF}
                  size={isMobile ? "default" : "sm"}
                  variant="outline"
                  className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                  disabled={isGeneratingPDF}
                >
                  <Download className="h-4 w-4" />
                  {!isMobile && "Descargar OT PDF"}
                </Button>
              )}
              {(userRole === 'admin' || userRole === 'gestor') && (
                <>
                  {order.status === 'draft' ? (
                    <Button 
                      onClick={() => navigate(`/pedidos/${id}/editar`)}
                      size={isMobile ? "default" : "sm"}
                      variant="outline"
                      className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                    >
                      <Edit className="h-4 w-4" />
                      {!isMobile && "Editar"}
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => { setEditReason(''); setEditConsent(false); setShowEditDialog(true); }}
                      size={isMobile ? "default" : "sm"}
                      variant="outline"
                      className={`gap-2 ${isMobile ? 'h-10 flex-1' : ''}`}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {!isMobile && "Editar"}
                    </Button>
                  )}
                </>
              )}
              {order.status === 'draft' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size={isMobile ? "default" : "sm"} 
                      variant="destructive" 
                      className={`gap-2 ${isMobile ? 'h-10 px-3' : ''}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      {!isMobile && "Eliminar"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. El pedido {order.order_number} será eliminado permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            
            {/* Toggle móvil de vistas - solo visible en móvil */}
            {userRole !== 'comercial' && isMobile && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'production' | 'administrative')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-11">
                  <TabsTrigger value="production" className="gap-2">
                    <Wrench className="h-4 w-4" />
                    Producción
                  </TabsTrigger>
                  <TabsTrigger value="administrative" className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Admin
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          </div>
        </CardHeader>
      </Card>

      {/* Edit Confirmation Dialog */}
      <AlertDialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Editar pedido {order?.order_number}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este pedido ya no está en borrador (estado: <strong>{order?.status ? statusLabels[order.status as keyof typeof statusLabels] || order.status : ''}</strong>). 
              Modificarlo puede afectar a producción y facturación. Esta acción quedará registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-reason" className="text-sm font-medium">Motivo de la edición *</Label>
              <Textarea
                id="edit-reason"
                placeholder="Explica por qué necesitas modificar este pedido..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox
                id="edit-consent"
                checked={editConsent}
                onCheckedChange={(checked) => setEditConsent(checked === true)}
              />
              <Label htmlFor="edit-consent" className="text-sm leading-tight cursor-pointer">
                Entiendo que esta modificación quedará registrada y puede afectar a procesos en curso
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!editReason.trim() || !editConsent}
              onClick={() => {
                // Store reason in sessionStorage for the edit page to use
                sessionStorage.setItem('edit_order_reason', editReason.trim());
                navigate(`/pedidos/${id}/editar`);
              }}
            >
              Continuar con la edición
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className={isMobile ? "rounded-none" : ""}>
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <CardTitle className="text-base">Información del pedido</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? "p-3 pt-2 space-y-2" : "space-y-2"}>
          {viewMode === 'administrative' ? (
            /* Vista Administrativa - Con precios y detalles comerciales */
            <>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 md:grid-cols-5 gap-2'}`}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">cliente</label>
                  <p className="text-sm font-medium mt-0.5">
                    <CustomerName 
                      customerId={order.customer_id} 
                      fallback="No asignado" 
                    />
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">estado</label>
                  <div className="mt-0.5">
                    <Select value={order.status} onValueChange={handleStatusChange} disabled={isExporting}>
                      <SelectTrigger className={isMobile ? "h-11 text-sm" : "h-7 text-xs"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Borrador</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="in_production">En Producción</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                        <SelectItem value="cancelled">Anulado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">total</label>
                  <p className="text-base font-semibold mt-0.5">{fmtEUR(order.final_price || 0)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">entrega</label>
                  <p className="text-sm mt-0.5">
                    {order.delivery_date 
                      ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
                      : 'No especificado'
                    }
                  </p>
                </div>
                {sourceQuoteNumber && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">presupuesto origen</label>
                    <p className="text-sm font-medium mt-0.5">
                      <Button 
                        variant="link" 
                        className="h-auto p-0 text-sm font-medium"
                        onClick={() => navigate(`/presupuestos/${order.quote_id}`)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        {sourceQuoteNumber}
                      </Button>
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Vista Producción - Sin precios */
            <>
              <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 md:grid-cols-4 gap-2'}`}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">cliente</label>
                  <p className="text-sm font-medium mt-0.5">
                    <CustomerName 
                      customerId={order.customer_id} 
                      fallback="No asignado" 
                    />
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">estado</label>
                  <div className="mt-0.5">
                    <Select value={order.status} onValueChange={handleStatusChange} disabled={isExporting}>
                      <SelectTrigger className={isMobile ? "h-11 text-sm" : "h-7 text-xs"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Borrador</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="in_production">En Producción</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                        <SelectItem value="cancelled">Anulado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">entrega</label>
                  <p className="text-sm mt-0.5">
                    {order.delivery_date 
                      ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
                      : 'No especificado'
                    }
                  </p>
                </div>
                {sourceQuoteNumber && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">presupuesto origen</label>
                    <p className="text-sm font-medium mt-0.5">
                      <Button 
                        variant="link" 
                        className="h-auto p-0 text-sm font-medium"
                        onClick={() => navigate(`/presupuestos/${order.quote_id}`)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        {sourceQuoteNumber}
                      </Button>
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Descripción y notas */}
          {(order.description || order.notes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
              {order.description && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">descripción</label>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{order.description}</p>
                </div>
              )}
              {order.notes && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">notas</label>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Barra de estados del pedido */}
          {order.status !== 'cancelled' ? (
            <div className="pt-3">
              <div className="flex items-center gap-2">
                <div className={`flex-1 h-2 rounded-full transition-all ${
                  order.status === 'draft' || order.status === 'pending' || order.status === 'in_production' || order.status === 'completed' ? 'bg-slate-400' : 'bg-muted'
                }`} title="Borrador" />
                <div className={`flex-1 h-2 rounded-full transition-all ${
                  order.status === 'pending' || order.status === 'in_production' || order.status === 'completed' ? 'bg-orange-500' : 'bg-muted'
                }`} title="Pendiente" />
                <div className={`flex-1 h-2 rounded-full transition-all ${
                  order.status === 'in_production' || order.status === 'completed' ? 'bg-green-500' : 'bg-muted'
                }`} title="En producción" />
                <div className={`flex-1 h-2 rounded-full transition-all ${
                  order.status === 'completed' ? 'bg-blue-500' : 'bg-muted'
                }`} title="Terminado" />
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>Borrador</span>
                <span>Pendiente</span>
                <span>En producción</span>
                <span>Terminado</span>
              </div>
            </div>
          ) : (
            <div className="pt-3 space-y-2">
              <Badge variant="destructive" className="text-sm">Pedido anulado</Badge>
              {order.cancellation_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-xs font-medium text-destructive mb-1">Motivo de anulación</p>
                  <p className="text-sm whitespace-pre-wrap">{order.cancellation_reason}</p>
                </div>
              )}
            </div>
          )}

          {order.status === 'draft' && order.created_from_scratch && isHoldedActive && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground">
                💡 Cambia a "Pendiente" para enviar automáticamente a Holded
              </p>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Artículos del Pedido */}
      <Card className={isMobile ? "rounded-none" : ""}>
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <CardTitle className="text-base">Artículos del pedido</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? "p-3 pt-0" : "pt-0"}>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay artículos en este pedido</p>
          ) : (
            <div className="space-y-2">{items.map((item, index) => {
                const itemOutputs = item.outputs && Array.isArray(item.outputs) ? item.outputs : [];
                const visibilityContext = viewMode === 'administrative' ? 'admin' : 'production';
                const filteredOutputs = (itemOutputs as Array<{ name: string; type: string; value: any }>).filter(
                  (o) => isVisibleIn(o.type, visibilityContext)
                );
                const itemPrompts = (item.prompts && Array.isArray(item.prompts) ? item.prompts : [])
                  .filter((p: any) => !isAdminOnlyPrompt(p.label || ''));
                const isExpanded = expandedItems.has(item.id);
                
                return (
                  <Collapsible
                    key={item.id}
                    open={isExpanded}
                    defaultOpen={false}
                    onOpenChange={() => {
                      const newExpanded = new Set(expandedItems);
                      if (isExpanded) {
                        newExpanded.delete(item.id);
                      } else {
                        newExpanded.add(item.id);
                      }
                      setExpandedItems(newExpanded);
                    }}
                  >
                      <div className="border rounded-lg">
                      <CollapsibleTrigger className={`w-full hover:bg-muted/50 transition-colors ${isMobile ? 'p-3' : 'p-4'}`}>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-3 flex-1 text-left min-w-0">
                            <ChevronDown
                              className={`h-5 w-5 transition-transform flex-shrink-0 ${
                                isExpanded ? "transform rotate-180" : ""
                              }`}
                            />
                            <h3 className={`font-semibold truncate ${isMobile ? 'text-base' : 'text-lg'}`}>{item.product_name}</h3>
                            {!isMobile && (
                              <div className="flex items-center gap-1 ml-3">
                                <div className={`w-5 h-1.5 rounded-full transition-all ${
                                  ['pending', 'in_progress', 'completed'].includes(item.production_status || '') ? 'bg-orange-500' : 'bg-muted'
                                }`} title="Pendiente" />
                                <div className={`w-5 h-1.5 rounded-full transition-all ${
                                  ['in_progress', 'completed'].includes(item.production_status || '') ? 'bg-green-500' : 'bg-muted'
                                }`} title="En proceso" />
                                <div className={`w-5 h-1.5 rounded-full transition-all ${
                                  item.production_status === 'completed' ? 'bg-blue-500' : 'bg-muted'
                                }`} title="Completado" />
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            {viewMode === 'administrative' && (
                              <p className={`font-bold text-primary ${isMobile ? 'text-lg' : 'text-xl'}`}>{(() => { const parts = Math.abs(item.price).toFixed(2).split('.'); const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return `${item.price < 0 ? '-' : ''}${intPart},${parts[1]} €`; })()}</p>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        {item.description && (
                          <p className={`text-sm text-muted-foreground whitespace-pre-line ${isMobile ? 'px-3 pt-2' : 'px-4 pt-2'}`}>{item.description}</p>
                        )}
                        <div className={`space-y-4 ${isMobile ? 'px-3 pb-3 pt-2' : 'px-4 pb-4 pt-2'}`}>
                          <WorkOrderItem
                            item={{
                              id: item.id,
                              product_name: item.product_name,
                              quantity: item.quantity,
                              prompts: itemPrompts,
                              outputs: filteredOutputs,
                              description: item.description || undefined,
                              imposition_data: (item.imposition_data as any) || undefined,
                              composite_data: (item as any).composite_data || undefined,
                              notes: Array.isArray(item.notes) ? item.notes : undefined,
                            }}
                            onAddNote={() => {
                              setEditingNoteIndex(null);
                              setNotesText('');
                              setNotesDialogItem(item);
                            }}
                            onEditNote={(ni) => {
                              const notes = Array.isArray(item.notes) ? item.notes : [];
                              setEditingNoteIndex(ni);
                              setNotesText(notes[ni]?.text || '');
                              setNotesDialogItem(item);
                            }}
                            onDeleteNote={async (ni) => {
                              const notes = Array.isArray(item.notes) ? [...item.notes] : [];
                              notes.splice(ni, 1);
                              const updatedNotes = notes.length > 0 ? notes : null;
                              const success = await updateSalesOrderItem(item.id, { notes: updatedNotes as any });
                              if (success) {
                                setItems(prev => prev.map(it => it.id === item.id ? { ...it, notes: updatedNotes } : it));
                              }
                            }}
                            orderNumber={order.order_number}
                            customerName={order.customer_id ? undefined : 'Sin cliente'}
                            orderDate={format(new Date(order.order_date), 'dd/MM/yyyy', { locale: es })}
                            deliveryDate={order.delivery_date 
                              ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: es })
                              : undefined
                            }
                            itemIndex={index}
                            totalItems={items.length}
                            filterOutput={(o) => isVisibleIn(o.type, visibilityContext)}
                            filterPrompt={(p) => !isAdminOnlyPrompt(p.label || '')}
                          />
                          
                          {/* Imposición - Solo en vista producción */}
                          {viewMode === 'production' && !(order.status === 'in_production') && (
                            <div className="pt-2 border-t">
                              <ImpositionSection item={{
                                id: item.id,
                                imposition_data: item.imposition_data,
                                composite_data: (item as any).composite_data,
                                observations: (item as any).observations,
                                product_id: item.product_id,
                                prompts: item.prompts,
                                outputs: item.outputs,
                                organization_id: sessionStorage.getItem('selected_organization_id') || undefined,
                              }} onStatusUpdate={loadOrderData} />
                            </div>
                          )}

                          {/* Gestión de Producción integrada - Solo en vista producción y en producción */}
                          {order.status === 'in_production' && viewMode === 'production' && (
                            <div className="pt-2 border-t">
                              <ItemProductionCard item={{
                                ...item,
                                observations: (item as any).observations,
                                organization_id: sessionStorage.getItem('selected_organization_id') || undefined,
                              }} onStatusUpdate={loadOrderData} />
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}

              {/* Ajustes - Visible en ambas vistas */}
              {additionals.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Ajustes del pedido</h4>
                    {additionals.map((additional) => {
                      const cleanName = additional.name
                        .replace(/\s*Ajuste sobre el presupuesto\s*/gi, '')
                        .replace(/\s*Ajuste sobre el pedido\s*/gi, '')
                        .trim();
                      
                      return (
                        <div key={additional.id} className="flex justify-between text-sm">
                          <span className={additional.is_discount ? "text-green-600" : "text-muted-foreground"}>
                            {cleanName}:
                          </span>
                          <span className={additional.is_discount ? "text-green-600 font-medium" : "font-medium"}>
                            {additional.is_discount && "-"}
                            {additional.type === 'percentage' ? `${additional.value}%` : fmtEUR(additional.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Totals - Solo en vista administrativa */}
              {viewMode === 'administrative' && (
                <>
                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-base">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">{fmtEUR(order.subtotal)}</span>
                    </div>

                    {order.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Descuento:</span>
                        <span className="text-green-600 font-medium">-{fmtEUR(order.discount_amount)}</span>
                      </div>
                    )}

                    <Separator className="my-2" />

                    <div className="flex justify-between text-xl font-bold pt-2">
                      <span>Total del pedido:</span>
                      <span className="text-primary">{fmtEUR(order.final_price)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Attachments */}
      {order?.id && viewMode === 'administrative' && (
        <DocumentAttachments
          salesOrderId={order.id}
          organizationId={sessionStorage.getItem('selected_organization_id') || ''}
        />
      )}

      {/* Panel de Producción eliminado - ahora integrado en cada artículo */}

      {/* Cancellation Reason Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo de la anulación de este pedido. Esta información quedará registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="cancellation-reason" className="text-sm font-medium">
              Motivo de anulación *
            </Label>
            <Textarea
              id="cancellation-reason"
              placeholder="Ej: Cliente canceló el encargo, error en especificaciones..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancellation}
              disabled={!cancellationReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Item Notes Dialog */}
      <Dialog open={!!notesDialogItem} onOpenChange={(open) => { if (!open) setNotesDialogItem(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Notas del artículo</DialogTitle>
            <DialogDescription>{notesDialogItem?.product_name}</DialogDescription>
          </DialogHeader>
          
          {/* Existing notes */}
          {notesDialogItem?.notes && Array.isArray(notesDialogItem.notes) && notesDialogItem.notes.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {notesDialogItem.notes.map((note: any, i: number) => (
                <div key={i} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                  <p className="whitespace-pre-line">{note.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {note.author} · {new Date(note.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* New note input */}
          <div className="space-y-1">
            <Label className="text-sm">Nueva nota</Label>
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Escribe una nueva nota..."
              rows={3}
              disabled={savingNotes}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogItem(null)} disabled={savingNotes}>
              Cerrar
            </Button>
            <Button
              disabled={savingNotes || !notesText.trim()}
              onClick={async () => {
                if (!notesDialogItem || !notesText.trim()) return;
                setSavingNotes(true);
                const existingNotes = Array.isArray(notesDialogItem.notes) ? notesDialogItem.notes : [];
                const newNote = {
                  text: notesText.trim(),
                  author: membership?.display_name || 'Usuario',
                  date: new Date().toISOString(),
                };
                const updatedNotes = [...existingNotes, newNote];
                const success = await updateSalesOrderItem(notesDialogItem.id, { notes: updatedNotes as any });
                setSavingNotes(false);
                if (success) {
                  const updatedItem = { ...notesDialogItem, notes: updatedNotes };
                  setItems(prev => prev.map(it => it.id === notesDialogItem.id ? updatedItem : it));
                  setNotesDialogItem(updatedItem);
                  setNotesText('');
                }
              }}
            >
              {savingNotes ? "Guardando..." : "Añadir nota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesOrderDetail;
