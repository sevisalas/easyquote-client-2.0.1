import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit, ChevronDown } from "lucide-react";
import QuoteAdditionalsSelector from "@/components/quotes/QuoteAdditionalsSelector";
import DocumentAttachments from "@/components/quotes/DocumentAttachments";
import QuoteItem from "@/components/quotes/QuoteItem";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { isVisiblePrompt, type PromptDef } from "@/utils/promptVisibility";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuoteItem {
  id: string;
  name?: string;  // Nombre a mostrar (editable)
  product_name: string;  // Nombre original del producto API
  description?: string;  // Descripción (solo para productos custom)
  price: number;
  isFromSelections?: boolean;
  // QuoteItem component compatibility
  productId?: string;
  prompts?: Record<string, any>;
  outputs?: any[];
  multi?: any;
  displayName?: string;  // Nombre a mostrar (editable)
  productName?: string;  // Nombre original del producto API
  itemDescription?: string;  // Descripción (solo para productos custom)
  descriptionManual?: boolean;  // Flag: usuario editó la descripción manualmente
  description_manual?: boolean;  // From DB
  itemAdditionals?: any[];
  compositeData?: any;
}

interface SelectedQuoteAdditional {
  id: string;
  name: string;
  type: "net_amount" | "quantity_multiplier" | "percentage" | "custom";
  value: number;
  isCustom?: boolean;
  is_discount?: boolean;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id?: string;
  product_name?: string;
  title?: string;
  description?: string;
  notes?: string;
  status: string;
  valid_until?: string;
  subtotal: number;
  final_price: number;
  items?: QuoteItem[];
  selections?: any;
  customer?: { name: string };
  quote_additionals?: any[];
}

const fetchQuote = async (id: string): Promise<Quote> => {
  const { data, error } = await supabase
    .from("quotes")
    .select(
      `
      *,
      items:quote_items(*)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Presupuesto no encontrado");

  console.log("✅ Quote data loaded from DB:", data);
  console.log("✅ Quote items from DB:", data.items);
  return data as any;
};

// No longer needed - CustomerSelector handles fetching both local and Holded customers
// const fetchCustomers = async () => {
//   const { data, error } = await supabase
//     .from('customers')
//     .select('id, name')
//     .order('name');
//
//   if (error) throw error;
//   return data;
// };

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  sent: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const fmtEUR = (amount: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export default function QuoteEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { isHoldedActive, canExportQuotes } = useHoldedIntegration();

  const [formData, setFormData] = useState<Partial<Quote>>({});
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [quoteAdditionals, setQuoteAdditionals] = useState<SelectedQuoteAdditional[]>([]);
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isStatusChange, setIsStatusChange] = useState(false); // Track if update is from status change
  const [initialState, setInitialState] = useState<{
    formData: Partial<Quote>;
    items: QuoteItem[];
    quoteAdditionals: SelectedQuoteAdditional[];
  }>({ formData: {}, items: [], quoteAdditionals: [] });


  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => fetchQuote(id!),
    enabled: !!id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Customers are now handled by CustomerSelector component

  useEffect(() => {
    console.log('🔥🔥🔥 USE EFFECT CALLED - quote exists:', !!quote);
    if (quote) {
      console.log('🔥🔥🔥 QUOTE DATA:', JSON.stringify(quote, null, 2));
      // Detect if customer is from Holded and add prefix for selector
      const checkCustomerSource = async () => {
        if (quote.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id, source')
            .eq('id', quote.customer_id)
            .maybeSingle();
          
          return (customer && customer.source === 'holded') ? `holded:${quote.customer_id}` : quote.customer_id;
        }
        return quote.customer_id;
      };

      checkCustomerSource().then(customerIdValue => {
        setFormData({
          quote_number: quote.quote_number,
          customer_id: customerIdValue,
          title: quote.title,
          description: quote.description,
          notes: quote.notes,
          status: quote.status,
          valid_until: quote.valid_until,
        });
      });

      // Load quote additionals - the data is stored as JSON array in quotes.quote_additionals field
      const loadedAdditionals: SelectedQuoteAdditional[] = [];

      console.log("Raw quote_additionals data:", quote.quote_additionals);
      console.log("Type of quote_additionals:", typeof quote.quote_additionals);

      // Check if quote_additionals is a direct JSON array (most common case)
      if (Array.isArray(quote.quote_additionals)) {
        const jsonAdditionals = quote.quote_additionals.map((additional: any, index: number) => {
          // Clean ID: if it contains underscore with timestamp, extract only the UUID part
          let cleanId = additional.id;
          if (cleanId && typeof cleanId === 'string' && cleanId.includes('_')) {
            const parts = cleanId.split('_');
            // Check if first part is a valid UUID (36 chars with hyphens)
            if (parts[0] && parts[0].length === 36 && parts[0].includes('-')) {
              cleanId = parts[0];
            } else {
              // If not a valid UUID, treat as custom
              cleanId = null;
            }
          }
          
          return {
            id: cleanId || `temp-${Date.now()}-${index}`,
            name: additional.name,
            type: additional.type || "net_amount",
            value: parseFloat(additional.value) || 0,
            isCustom: !cleanId, // If no valid ID, it's custom
          };
        });
        loadedAdditionals.push(...jsonAdditionals);
        console.log("Loaded from JSON array:", jsonAdditionals);
      }

      setQuoteAdditionals(loadedAdditionals);
      console.log("Final loaded additionals:", loadedAdditionals);

      // Load existing items from both sources: database items and JSON selections
      const allItems: QuoteItem[] = [];
      
      const currentFormData = {
        quote_number: quote.quote_number,
        customer_id: quote.customer_id,
        title: quote.title,
        description: quote.description,
        notes: quote.notes,
        status: quote.status,
        valid_until: quote.valid_until,
      };

      // Load from database (quote_items table)
      if (quote.items && quote.items.length > 0) {
        console.log('🔍 Loading items from DB - count:', quote.items.length);
        console.log('🔍 Quote selections (valores guardados):', quote.selections);
        
        const dbItems = quote.items.map((item: any, idx: number) => {
          console.log(`🔍 Processing item ${idx}:`, {
            id: item.id,
            product_name: item.product_name,
            product_id: item.product_id,
            promptsInQuoteItems: item.prompts,
            outputsLength: Array.isArray(item.outputs) ? item.outputs.length : 'N/A'
          });
          
          // Los valores están guardados correctamente en quote_items.prompts como array [{id, label, value, order}]
          let promptsObj: Record<string, any> = {};
          
          if (Array.isArray(item.prompts) && item.prompts.length > 0) {
            // Convertir array [{id, label, value, order}] a objeto {id: {label, value, order}}
            item.prompts.forEach((prompt: any) => {
              if (prompt && prompt.id && prompt.value !== undefined && prompt.value !== null && prompt.value !== '') {
                promptsObj[prompt.id] = {
                  label: prompt.label || prompt.id,
                  value: prompt.value,
                  order: prompt.order ?? 999
                };
              }
            });
            console.log(`✅ Item ${idx}: Loaded ${Object.keys(promptsObj).length} prompts from DB:`, promptsObj);
          } else if (typeof item.prompts === 'object' && item.prompts !== null && !Array.isArray(item.prompts)) {
            // Ya está en formato objeto
            promptsObj = item.prompts;
            console.log(`✅ Item ${idx}: prompts already in object format`);
          } else {
            console.warn(`⚠️ Item ${idx}: No valid prompts found in DB`);
          }

          const mappedItem = {
            id: item.id,
            product_name: item.product_name || "",  // Nombre original del producto API
            name: item.name || item.product_name || "",  // Nombre a mostrar
            description: item.description || "",  // Descripción (solo para productos custom)
            price: item.price || 0,
            // QuoteItem compatibility
            productId: item.product_id || "",
            prompts: promptsObj,
            outputs: Array.isArray(item.outputs) ? item.outputs : [],
            multi:
              item.multi && typeof item.multi === "object" && (item.multi.qtyInputs || item.multi.qtyPrompt)
                ? item.multi
                : undefined,
            displayName: item.name || item.product_name || "",  // Nombre a mostrar
            productName: item.product_name || "",  // Nombre original del producto API
            itemDescription: item.description || "",  // Descripción (solo para productos custom)
            descriptionManual: item.description_manual || false,  // Flag: usuario editó la descripción
            itemAdditionals: Array.isArray(item.item_additionals) ? item.item_additionals : [],
            compositeData: item.composite_data || undefined,
          };
          console.log(`🔍 Mapped item ${idx}:`, {
            id: mappedItem.id,
            promptsCount: Object.keys(mappedItem.prompts).length,
            outputsCount: mappedItem.outputs.length
          });
          return mappedItem;
        });
        console.log('🔍 Total dbItems created:', dbItems.length);
        allItems.push(...dbItems);
      } else {
        console.log('⚠️ No quote.items found or empty array');
      }

      // Load from JSON selections (if no database items)
      if (allItems.length === 0 && quote.selections && Array.isArray(quote.selections)) {
        const jsonItems = quote.selections.map((selection: any, index: number) => {
          // Ensure prompts are in object format
          let promptsObj: Record<string, any> = {};
          if (Array.isArray(selection.prompts)) {
            selection.prompts.forEach((prompt: any) => {
              promptsObj[prompt.id] = {
                label: prompt.label,
                value: prompt.value,
                order: prompt.order,
              };
            });
          } else if (typeof selection.prompts === "object" && selection.prompts !== null) {
            promptsObj = selection.prompts;
          }

          return {
            id: `json-${index}`,
            product_name: selection.productName || selection.displayName || selection.itemDescription || "",
            name: selection.displayName || selection.itemDescription || "",
            description: selection.itemDescription || "",
            price: selection.price || 0,
            isFromSelections: true,
            // QuoteItem compatibility
            productId: selection.productId || "",
            prompts: promptsObj,
            outputs: selection.outputs || [],
            multi: selection.multi,
            displayName: selection.displayName || selection.itemDescription || "",
            productName: selection.productName || "",
            itemDescription: selection.itemDescription || "",
            itemAdditionals: selection.itemAdditionals || [],
          };
        });
        allItems.push(...jsonItems);
      }

      setItems(allItems);
      
      // Guardar estado inicial después de cargar todo
      setInitialState({
        formData: currentFormData,
        items: allItems,
        quoteAdditionals: loadedAdditionals,
      });
    }
  }, [quote]);

  // Check if any item has multiple quantities enabled
  const hasMultiQuantities = items.some(
    (item) => item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1,
  );

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: Partial<Quote>) => {
      // Extract UUID from "holded:" prefix if present
      const actualCustomerId = data.customer_id?.startsWith('holded:') 
        ? data.customer_id.replace('holded:', '') 
        : data.customer_id;

      // Preparar quote_additionals JSONB para persistencia
      const quoteAdditionalsJson = quoteAdditionals.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        value: a.value,
        isCustom: a.isCustom || false,
        is_discount: a.is_discount || false,
      }));

      const { error } = await supabase
        .from("quotes")
        .update({
          customer_id: actualCustomerId,
          title: data.title,
          description: data.description,
          notes: data.notes,
          status: data.status,
          valid_until: data.valid_until,
          subtotal: calculateSubtotal(),
          final_price: calculateTotal(),
          selections: null,
          quote_additionals: quoteAdditionalsJson,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      // Delete existing items and insert new ones to simplify the update process
      await supabase.from("quote_items").delete().eq("quote_id", id);

      // Insert all current items
      if (items.length > 0) {
          const itemsToInsert = items.map((item, index) => {
          console.log(`📦 Preparando item ${index} para guardar:`, {
            id: item.id,
            productId: item.productId,
            prompts: item.prompts,
            promptsType: typeof item.prompts,
            promptsKeys: item.prompts ? Object.keys(item.prompts) : [],
            promptsCount: item.prompts ? Object.keys(item.prompts).length : 0
          });
          
            // Normalizar prompts a array [{id,label,value,order}] para persistencia.
            // Runtime debe ser objeto {id:{label,value,order}}, pero soportamos array por compatibilidad.
            const promptsArray = (() => {
              const raw: any = (item as any).prompts;
              if (Array.isArray(raw)) {
                return raw
                  .filter((p: any) => p && p.id)
                  .map((p: any) => ({
                    id: String(p.id),
                    label: p.label ?? String(p.id),
                    value: p.value,
                    order: p.order ?? 999,
                  }));
              }

              if (raw && typeof raw === "object") {
                return Object.entries(raw)
                  .map(([pid, promptData]: [string, any]) => {
                    if (typeof promptData === "object" && promptData !== null && "value" in promptData) {
                      return {
                        id: pid,
                        label: promptData.label || pid,
                        value: promptData.value,
                        order: promptData.order ?? 999,
                      };
                    }
                    return {
                      id: pid,
                      label: pid,
                      value: promptData,
                      order: 999,
                    };
                  });
              }

              return [] as any[];
            })().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

          console.log(`✅ Item ${index} - Prompts array generado:`, {
            count: promptsArray.length,
            sample: promptsArray.slice(0, 5),
            all: promptsArray
          });

          // Auto-generar descripción desde prompts visibles si no fue editada manualmente
          let description = item.description || item.itemDescription || "";
          const isManual = (item as any).descriptionManual || (item as any).description_manual || false;
          if (!isManual && !description && promptsArray.length > 0) {
            const excludeLabels = ["tarifa", "forzar máquina", "forzar maquina", "tira y retira", "forzar poses", "forzar poses/pags.", "modelos"];
            description = promptsArray
              .filter((p: any) => {
                const val = String(p.value ?? "").trim();
                const label = String(p.label ?? "").toLowerCase();
                if (!val || val === "" || val.toLowerCase() === "no") return false;
                if (excludeLabels.some(ex => label.includes(ex))) return false;
                return true;
              })
              .map((p: any) => `${p.label}: ${String(p.value).trim()}`)
              .join("\n");
          }

          return {
            quote_id: id,
            product_name: item.product_name || item.productName || "",  // Nombre original del producto API
            name: item.name || item.displayName || item.product_name || "",  // Nombre a mostrar
            description,
            description_manual: isManual,
            price: item.price || 0,
            position: index,
            product_id: item.productId || null,
            prompts: promptsArray,
            outputs: item.outputs || [],
            multi: item.multi || null,
            item_additionals: item.itemAdditionals || [],
            composite_data: item.compositeData || null,
          };
        });

        const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Update quote additionals
      await supabase.from("quote_additionals").delete().eq("quote_id", id);

      if (quoteAdditionals.length > 0) {
        const additionalsToInsert = quoteAdditionals.map((additional) => ({
          quote_id: id,
          additional_id: additional.isCustom || !additional.id || String(additional.id).startsWith('temp-') ? null : additional.id,
          name: additional.name,
          type: additional.type,
          value: additional.value,
        }));

        const { error: additionalsError } = await supabase.from("quote_additionals").insert(additionalsToInsert);

        if (additionalsError) throw additionalsError;
      }
    },
    onSuccess: () => {
      toast.success("Presupuesto actualizado correctamente");
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      
      // Only navigate if not a status change (to allow Holded export to complete)
      if (!isStatusChange) {
        navigate(`/presupuestos/${id}`);
      }
      
      // Reset the flag
      setIsStatusChange(false);
    },
    onError: (error) => {
      toast.error("Error al actualizar el presupuesto");
      console.error("Error:", error);
    },
  });

  const calculateSubtotal = () => {
    const MAX_PRICE = 1_000_000_000;
    const safePrice = (val: unknown): number => {
      const n = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(n) || n < 0) return 0;
      return n > MAX_PRICE ? MAX_PRICE : n;
    };

    // Use item.price directly — it already includes base price + item additionals,
    // calculated by QuoteItem's finalPrice logic.
    return items.reduce((sum, item) => {
      return sum + safePrice((item as any)?.price);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let total = subtotal;

    console.log("🔢 Calculando total - Subtotal:", subtotal);
    console.log("🔢 Ajustes a aplicar:", quoteAdditionals);

    // Aplicar ajustes
    quoteAdditionals.forEach((additional) => {
      switch (additional.type) {
        case "net_amount":
          console.log(`🔢 Aplicando net_amount: ${additional.value}`);
          total += additional.value;
          break;
        case "percentage":
          const percentageAmount = (subtotal * additional.value) / 100;
          console.log(`🔢 Aplicando percentage: ${additional.value}% = ${percentageAmount}`);
          total += percentageAmount;
          break;
        case "quantity_multiplier":
          console.log(`🔢 Aplicando multiplier: ×${additional.value}`);
          total *= additional.value;
          break;
        default:
          console.log(`🔢 Aplicando default: ${additional.value}`);
          total += additional.value;
      }
    });

    console.log("🔢 Total final calculado:", total);
    return total;
  };

  const handleInputChange = (field: keyof Quote, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemEdit = (itemId: string | number) => {
    const id = itemId.toString();
    setEditingItems((prev) => new Set([...prev, id]));
  };

  const handleItemSaveEdit = (itemId: string | number) => {
    const id = itemId.toString();
    setEditingItems((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleItemChange = useCallback((itemId: string | number, snapshot: any) => {
    console.log('📥 handleItemChange - snapshot recibido:', {
      itemId,
      prompts: snapshot.prompts,
      promptsType: Array.isArray(snapshot.prompts) ? 'array' : typeof snapshot.prompts
    });
    
    // Convertir prompts de array a objeto para mantener consistencia
    let promptsObj: Record<string, any> = {};
    if (Array.isArray(snapshot.prompts)) {
      // Si viene como array [{id, label, value, order}], convertir a objeto
      snapshot.prompts.forEach((p: any) => {
        if (p && p.id) {
          promptsObj[p.id] = {
            label: p.label || p.id,
            value: p.value,
            order: p.order ?? 999
          };
        }
      });
      console.log('✅ Prompts convertidos de array a objeto:', {
        originalCount: snapshot.prompts.length,
        convertedCount: Object.keys(promptsObj).length,
        sample: Object.entries(promptsObj).slice(0, 3)
      });
    } else if (typeof snapshot.prompts === 'object' && snapshot.prompts !== null) {
      // Si ya es objeto, usar tal cual
      promptsObj = snapshot.prompts;
      console.log('✅ Prompts ya en formato objeto:', Object.keys(promptsObj).length);
    }
    
    setItems((prev) => {
      return prev.map((item, index) =>
        item.id === itemId || index.toString() === itemId.toString()
          ? {
              ...item,
              product_name: snapshot.productName || item.product_name,  // Nombre original del producto API
              name: snapshot.displayName || item.name,  // Nombre a mostrar
              description: snapshot.itemDescription || item.description,  // Descripción del artículo
              price: snapshot.price || 0,
              // Update QuoteItem fields
              productId: snapshot.productId,
              prompts: promptsObj,  // ✅ Ahora siempre es objeto
              outputs: snapshot.outputs,
              multi: snapshot.multi,
              displayName: snapshot.displayName,
              productName: snapshot.productName,
              itemDescription: snapshot.itemDescription,
              itemAdditionals: snapshot.itemAdditionals,
              compositeData: snapshot.compositeData,
            }
          : item,
      );
    });
  }, []);

  const handleItemRemove = (itemId: string | number) => {
    setItems((prev) =>
      prev.filter((item, index) => {
        return item.id !== itemId && index.toString() !== itemId.toString();
      }),
    );
  };

  const addItem = () => {
    const newItemId = `temp-${Date.now()}`;
    const newItem: QuoteItem = {
      id: newItemId,
      product_name: "",
      name: "",
      description: "",
      price: 0,
      // QuoteItem compatibility
      productId: "",
      prompts: {},
      outputs: [],
      multi: undefined,
      displayName: "",
      productName: "",
      itemDescription: "",
      itemAdditionals: [],
    };
    setItems((prev) => [...prev, newItem]);
    // Abrir automáticamente en modo edición
    setEditingItems((prev) => new Set([...prev, newItemId]));
  };

  const hasUnsavedChanges = () => {
    // Comparar formData
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialState.formData);
    
    // Comparar items
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(initialState.items);
    
    // Comparar additionals
    const additionalsChanged = JSON.stringify(quoteAdditionals) !== JSON.stringify(initialState.quoteAdditionals);
    
    return formChanged || itemsChanged || additionalsChanged;
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setShowCancelDialog(true);
    } else {
      navigate(`/presupuestos/${id}`);
    }
  };

  const handleSave = () => {
    console.log('💾 GUARDANDO - Estado actual de items:', items.map(item => ({
      id: item.id,
      productId: item.productId,
      promptsKeys: Object.keys(item.prompts || {}),
      promptsCount: Object.keys(item.prompts || {}).length,
      prompts: item.prompts
    })));
    updateQuoteMutation.mutate(formData);
  };

  const handleStatusChange = async (newStatus: string) => {
    // Block sending if customer has no holded_id and Holded is active
    if ((newStatus === 'sent' || newStatus === 'approved') && canExportQuotes) {
      // Check customer holded_id
      if (formData.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('holded_id')
          .eq('id', formData.customer_id)
          .maybeSingle();
        if (!customer?.holded_id) {
          toast.error('El cliente no está vinculado a Holded. Importa o crea el contacto en Holded primero.');
          return;
        }
      }
    }

    // Actualizar formData con el nuevo estado
    const updatedFormData = { ...formData, status: newStatus };
    setFormData(updatedFormData);
    
    // Set flag to prevent navigation in onSuccess
    setIsStatusChange(true);
    
    try {
      // Guardar automáticamente con el nuevo estado y esperar a que se complete
      await updateQuoteMutation.mutateAsync(updatedFormData);

      // Si el estado es "sent" y se permite exportar presupuestos a Holded, exportar automáticamente
      if (newStatus === 'sent' && canExportQuotes && id) {
        console.log('🚀 Attempting to export to Holded after status change to sent');
        try {
          const { error: holdedError } = await supabase.functions.invoke('holded-export-estimate', {
            body: { quoteId: id }
          });

          if (holdedError) {
            console.error('❌ Error exporting to Holded:', holdedError);
            toast.warning("Presupuesto enviado, pero hubo un error al exportar a Holded");
          } else {
            console.log('✅ Successfully exported to Holded');
            toast.success("Presupuesto exportado a Holded exitosamente");
          }
        } catch (holdedErr) {
          console.error('❌ Error exporting to Holded:', holdedErr);
          toast.warning("Presupuesto enviado, pero hubo un error al exportar a Holded");
        }
      }

      // Redirect to detail view after status change (can't edit non-draft)
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      navigate(`/presupuestos/${id}`);
    } catch (error) {
      console.error('Error in handleStatusChange:', error);
      setIsStatusChange(false); // Reset flag on error
      // El error del guardado ya se maneja en onError de la mutación
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

  if (!quote) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-destructive">Presupuesto no encontrado</p>
            <Button onClick={() => navigate("/presupuestos")} className="mt-3">
              Volver a presupuestos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if quote is editable
  const isEditable = quote.status === "draft" || quote.status === "pending";

  if (!isEditable) {
    return (
      <div className="container mx-auto py-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-destructive font-medium">Este presupuesto no se puede editar</p>
            <p className="text-sm text-muted-foreground">
              Los presupuestos en estado "
              {statusLabels[quote.status] || quote.status}" no pueden ser
              modificados. Si necesitas realizar cambios, puedes duplicarlo como una nueva versión.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate(`/presupuestos/${id}`)} className="mt-2">
                Ver presupuesto
              </Button>
              <Button onClick={() => navigate("/presupuestos")} variant="outline" className="mt-2">
                Volver a lista
              </Button>
            </div>
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
              <CardTitle className="text-lg">Presupuesto: {quote.quote_number}</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={updateQuoteMutation.isPending} size="sm">
                {updateQuoteMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
              <Button onClick={handleCancel} size="sm" variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quote Details */}
      <Card>
        <CardContent className="space-y-2 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1.5">
              <CustomerSelector
                value={formData.customer_id || ""}
                onValueChange={(value) => handleInputChange("customer_id", value)}
                label="cliente"
                placeholder="Seleccionar cliente..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">estado</Label>
              <div className="flex items-center gap-2 h-10">
                <Badge variant={formData.status === 'draft' ? 'secondary' : formData.status === 'sent' ? 'outline' : 'default'}>
                  {statusLabels[formData.status || 'draft']}
                </Badge>
                {/* Action buttons based on current status */}
                {(formData.status === 'draft' || formData.status === 'pending') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange('sent')}
                    className="h-7 text-xs"
                  >
                    {canExportQuotes ? 'Enviar a Holded' : 'Enviar'}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">
                título
              </Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Título del presupuesto"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valid_until" className="text-xs">
                Válido hasta
              </Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until || ""}
                onChange={(e) => handleInputChange("valid_until", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs">
                Descripción
              </Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Descripción del presupuesto"
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs">
                Notas
              </Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Notas adicionales"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          {isHoldedActive && hasMultiQuantities && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">
                (Este presupuesto tiene múltiples cantidades, cada cantidad se exportará como un artículo separado en
                Holded)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items card continues below */}

      {/* Quote Items */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Artículos del presupuesto</CardTitle>
            {editingItems.size === 0 && (
              <Button onClick={addItem} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Añadir artículo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {items.map((item, index) => {
              const itemId = (item.id || index).toString();
              const isEditing = editingItems.has(itemId);
              const isExpanded = expandedItems.has(itemId);
              
              // Check if item has details to show
              const itemOutputs = item.outputs && Array.isArray(item.outputs) ? item.outputs : [];
              const itemPrompts = item.prompts && typeof item.prompts === 'object' ? item.prompts : {};
              
              // Debug: mostrar los prompts en consola
              console.log('📋 Item prompts para', item.product_name || item.name, ':', itemPrompts);
              
              const itemDescription = item.description || item.itemDescription || '';
              const hasDetails = itemOutputs.length > 0 || Object.keys(itemPrompts).length > 0 || !!itemDescription;

              return (
                <div
                  key={item.id || index}
                  className="bg-card border border-border rounded-md p-2 border-r-2 border-r-secondary hover:shadow transition-all duration-200"
                >
                  {isEditing ? (
                    // Editing mode - show only QuoteItem component
                    <>
                      {console.log('🔍 Passing to QuoteItem - item:', item)}
                      <QuoteItem
                        hasToken={true}
                        id={itemId}
                        initialData={{
                          productId: item.productId || "",
                          prompts: item.prompts || {},
                          outputs: item.outputs || [],
                          price: item.price || 0,
                          multi: item.multi,
                          displayName: item.displayName || item.name || item.product_name || "",
                          productName: item.productName || item.product_name || "",
                          itemDescription: item.itemDescription || item.description || "",
                          itemAdditionals: item.itemAdditionals || [],
                          compositeData: item.compositeData,
                        }}
                        onChange={handleItemChange}
                        onRemove={handleItemRemove}
                        onFinishEdit={handleItemSaveEdit}
                      />
                    </>
                  ) : (
                    // View mode with collapsible details
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={(open) => {
                        setExpandedItems(prev => {
                          const newSet = new Set(prev);
                          if (open) {
                            newSet.add(itemId);
                          } else {
                            newSet.delete(itemId);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <div className="space-y-2">
                        {(() => {
                          const isCustomProduct = item.productId === '__CUSTOM_PRODUCT__';
                          const customQuantity = isCustomProduct ? (itemPrompts as any)?.custom_quantity?.value : null;
                          const hasCustomDetails = isCustomProduct && (item.description || item.itemDescription);
                          
                          return (
                            <>
                              <div className="flex justify-between items-center gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {(hasDetails || hasCustomDetails) && (
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      </Button>
                                    </CollapsibleTrigger>
                                  )}
                                  <p className="text-sm font-medium truncate">
                                    {/* Para productos personalizados: mostrar displayName o name, NO description */}
                                    {isCustomProduct 
                                      ? (item.displayName || item.name || "Artículo personalizado")
                                      : (item.displayName || item.name || item.product_name || "-")
                                    }
                                    {item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1 && (
                                      <span className="text-xs text-muted-foreground ml-2">(cantidad múltiple activada)</span>
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-sm font-medium text-secondary text-right">{fmtEUR(item.price || 0)}</div>
                                  <div className="flex items-center gap-2">
                                    <Button onClick={() => handleItemEdit(itemId)} size="sm" variant="outline" className="gap-1">
                                      <Edit className="h-3 w-3" />
                                      Editar
                                    </Button>
                                    <Button
                                      onClick={() => handleItemRemove(item.id || index)}
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Eliminar
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Collapsible details */}
                              <CollapsibleContent className="space-y-2">
                                {/* Para productos personalizados: mostrar descripción y cantidad */}
                                {isCustomProduct && (
                                  <div className="pl-8 space-y-1 border-l-2 border-muted">
                                    {(item.description || item.itemDescription) && (
                                      <div className="text-sm">
                                        <span className="font-medium text-muted-foreground">Descripción:</span>{' '}
                                        <span className="text-foreground">{item.description || item.itemDescription}</span>
                                      </div>
                                    )}
                                    {customQuantity && (
                                      <div className="text-sm">
                                        <span className="font-medium text-muted-foreground">Cantidad:</span>{' '}
                                        <span className="text-foreground">{customQuantity}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Descripción del artículo - para productos NO personalizados */}
                                {!isCustomProduct && itemDescription && (
                                  <div className="pl-8 space-y-1 border-l-2 border-muted mb-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase">Descripción</p>
                                    <div className="text-sm text-foreground whitespace-pre-line">{itemDescription}</div>
                                  </div>
                                )}
                                {/* Prompts - solo para productos NO personalizados */}
                                {!isCustomProduct && Object.keys(itemPrompts).length > 0 && (() => {
                                  const visiblePrompts = Object.entries(itemPrompts)
                                    .sort(([, a]: [string, any], [, b]: [string, any]) => {
                                      const orderA = typeof a === 'object' && a !== null ? (a.order ?? 999) : 999;
                                      const orderB = typeof b === 'object' && b !== null ? (b.order ?? 999) : 999;
                                      return orderA - orderB;
                                    });

                                  if (visiblePrompts.length === 0) return null;

                                  return (
                                    <div className="pl-8 space-y-1 border-l-2 border-muted">
                                      <p className="text-xs font-semibold text-muted-foreground uppercase">Opciones seleccionadas</p>
                                      {visiblePrompts.map(([key, promptData]: [string, any], idx: number) => {
                                        const label = typeof promptData === 'object' && promptData !== null && promptData.label 
                                          ? promptData.label 
                                          : key;
                                        const value = typeof promptData === 'object' && promptData !== null && 'value' in promptData 
                                          ? promptData.value 
                                          : promptData;
                                        
                                        const valueStr = value === null || value === undefined ? '' : String(value);
                                        
                                        if (valueStr && valueStr.startsWith('http')) {
                                          return (
                                            <div key={idx} className="text-sm">
                                              <span className="font-medium text-muted-foreground">{label}:</span>
                                              <img 
                                                src={valueStr} 
                                                alt={label}
                                                className="mt-1 w-32 h-32 object-contain rounded border"
                                              />
                                            </div>
                                          );
                                        }
                                        
                                        if (valueStr && valueStr.startsWith('#')) {
                                          return (
                                            <div key={idx} className="text-sm flex items-center gap-2">
                                              <span className="font-medium text-muted-foreground">{label}:</span>
                                              <div className="flex items-center gap-2">
                                                <div 
                                                  className="w-6 h-6 rounded border shadow-sm"
                                                  style={{ backgroundColor: valueStr }}
                                                />
                                                <span className="text-foreground">{valueStr}</span>
                                              </div>
                                            </div>
                                          );
                                        }
                                        
                                        return (
                                          <div key={idx} className="text-sm">
                                            <span className="font-medium text-muted-foreground">{label}:</span>{' '}
                                            <span className="text-foreground">{valueStr || '(vacío)'}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </CollapsibleContent>
                            </>
                          );
                        })()}
                      </div>
                    </Collapsible>
                  )}
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No hay artículos en este presupuesto</p>
                <p className="text-xs mt-1">Utiliza el botón "Añadir artículo" de arriba para comenzar</p>
              </div>
            )}
          </div>

          {/* Quote Adjustments - inline within items card */}
          <div className="mt-4 pt-3 border-t border-border">
            <h4 className="text-sm font-semibold mb-2">Ajustes del presupuesto</h4>
            <QuoteAdditionalsSelector selectedAdditionals={quoteAdditionals} onChange={setQuoteAdditionals} />
          </div>

          {items.length > 0 && (
            <>
              <div className="bg-muted/30 rounded-md p-3 border border-border space-y-1.5 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Subtotal:</span>
                  <span className="text-sm font-medium">{fmtEUR(calculateSubtotal())}</span>
                </div>

                {/* Mostrar ajustes aplicados */}
                {quoteAdditionals.length > 0 && (
                  <>
                    {quoteAdditionals.map((additional, index) => {
                      let amount = 0;
                      const cleanName = additional.name
                        .replace(/\s*Ajuste sobre el presupuesto\s*/gi, '')
                        .replace(/\s*Ajuste sobre el pedido\s*/gi, '')
                        .trim();
                      let displayText = "";
                      const subtotal = calculateSubtotal();

                      switch (additional.type) {
                        case "percentage":
                          amount = (subtotal * additional.value) / 100;
                          displayText = `${cleanName} (${additional.value}%)`;
                          break;
                        case "net_amount":
                          amount = additional.value;
                          displayText = cleanName;
                          break;
                        case "quantity_multiplier":
                          displayText = `${cleanName} (×${additional.value})`;
                          break;
                        default:
                          amount = additional.value;
                          displayText = cleanName;
                      }

                      if (additional.type !== "quantity_multiplier") {
                        return (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">{displayText}:</span>
                            <span className={`text-sm font-medium ${amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {amount >= 0 ? "+" : ""}
                              {fmtEUR(amount)}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </>
                )}

                <div className="flex justify-between items-center pt-3">
                  <span className="text-base font-semibold text-foreground">Total del presupuesto:</span>
                  <span className="text-xl font-bold text-secondary">{fmtEUR(calculateTotal())}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Document Attachments */}
      {id && (
        <DocumentAttachments
          quoteId={id}
          organizationId={sessionStorage.getItem('selected_organization_id') || ''}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios que has realizado se perderán si no los guardas. ¿Estás seguro de que quieres salir sin guardar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/presupuestos/${id}`)}>
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
