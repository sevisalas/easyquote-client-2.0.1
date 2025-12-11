import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import PromptsForm, { extractPrompts, isVisiblePrompt, type PromptDef } from "@/components/quotes/PromptsForm";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import AdditionalsSelector from "@/components/quotes/AdditionalsSelector";
import { ChevronDown, ChevronUp, Pencil, Trash2, Package } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Special product ID for custom/manual items
const CUSTOM_PRODUCT_ID = "__CUSTOM_PRODUCT__";

type ItemSnapshot = {
  productId: string;
  prompts: Record<string, any>;
  outputs: any[];
  price?: any;
  multi?: any;
  needsRecalculation?: boolean;
  itemDescription?: string;
  itemAdditionals?: any[];
  isFinalized?: boolean;
};

interface QuoteItemProps {
  hasToken: boolean;
  id: string | number;
  initialData?: ItemSnapshot;
  onChange?: (id: string | number, snapshot: ItemSnapshot) => void;
  onRemove?: (id: string | number) => void;
  onFinishEdit?: (id: string | number) => void;
  shouldExpand?: boolean;
  hideMultiQuantities?: boolean;
}

interface Additional {
  id: string;
  name: string;
  description?: string;
  type: 'net' | 'quantity';
  default_value: number;
}

export default function QuoteItem({ hasToken, id, initialData, onChange, onRemove, onFinishEdit, shouldExpand, hideMultiQuantities = false }: QuoteItemProps) {
  // Local state per item
  const [productId, setProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [debouncedPromptValues, setDebouncedPromptValues] = useState<Record<string, any>>({});
  const [forceRecalculate, setForceRecalculate] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(shouldExpand === true); // Solo expandir si shouldExpand es explícitamente true
  const [userCollapsed, setUserCollapsed] = useState<boolean>(false); // Flag para colapso manual del usuario
  const [itemDescription, setItemDescription] = useState<string>("");
  const [isNewProduct, setIsNewProduct] = useState<boolean>(true);
  const [hasInitialOutputs, setHasInitialOutputs] = useState<boolean>(false);
  const [userHasChangedCurrentProduct, setUserHasChangedCurrentProduct] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false); // Flag para prevenir sync durante inicialización
  const [hasPerformedInitialLoad, setHasPerformedInitialLoad] = useState<boolean>(false); // Flag para primera carga de artículos guardados
  const selectRef = useRef<HTMLButtonElement>(null);

  // Auto-expand/collapse based on shouldExpand prop - pero respetar colapso manual del usuario
  useEffect(() => {
    if (shouldExpand === true && !userCollapsed) {
      setIsExpanded(true);
    } else if (shouldExpand === false && !userCollapsed) {
      setIsExpanded(false);
    }
  }, [shouldExpand, id, userCollapsed]);

  // Multi-cantidades
  const [multiEnabled, setMultiEnabled] = useState<boolean>(false);
  const [qtyPrompt, setQtyPrompt] = useState<string>("");
  const [qtyInputs, setQtyInputs] = useState<string[]>(["", "", "", "", ""]);
  const MAX_QTY = 10;
  const [qtyCount, setQtyCount] = useState<number>(5);

  // Item additionals
  const [itemAdditionals, setItemAdditionals] = useState<any[]>([]);

  // Custom product fields (when CUSTOM_PRODUCT_ID is selected)
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customQuantity, setCustomQuantity] = useState<number>(1);
  const isCustomProduct = productId === CUSTOM_PRODUCT_ID;
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const initialStateRef = useRef<string>("");

  // Inicialización desde datos previos (duplicar)
  const initializedRef = useRef(false);
  const lastSyncedSnapshot = useRef<string>("");
  
  // Reset initialization when item ID changes OR when initialData changes significantly
  useEffect(() => {
    initializedRef.current = false;
  }, [id, initialData?.productId]);
  
  // Log para debug - ver si initialData llega
  console.log('🔍 QuoteItem rendered with initialData:', initialData);
  
  useEffect(() => {
    console.log('🔍 useEffect executed - initializedRef:', initializedRef.current, 'initialData:', initialData);
    if (initializedRef.current) {
      console.log('⚠️ useEffect cancelled - already initialized');
      return;
    }
    if (!initialData) {
      console.log('⚠️ No initialData - producto nuevo');
      initializedRef.current = true;
      return;
    }
    initializedRef.current = true;
    try {
      console.log('✅ Starting initialization with initialData:', initialData);
      setProductId(initialData.productId || "");
      
      // Preservar TODOS los datos de los prompts guardados (label, value, order)
      const promptValuesOnly: Record<string, any> = {};
      if (initialData.prompts) {
        console.log('🔍 Raw prompts from DB:', initialData.prompts);
        
        // Handle array format [{id, label, order, value}]
        if (Array.isArray(initialData.prompts)) {
          initialData.prompts.forEach((prompt: any) => {
            if (prompt.id) {
              // Preservar el objeto completo con label, value y order
              promptValuesOnly[prompt.id] = {
                label: prompt.label || prompt.id,
                value: prompt.value,
                order: prompt.order ?? 999
              };
              console.log(`  📌 Loaded prompt ${prompt.id}:`, promptValuesOnly[prompt.id]);
            }
          });
        } else {
          // Handle object format {promptId: {label, value, order}} or {promptId: value}
          Object.entries(initialData.prompts).forEach(([promptId, promptData]: [string, any]) => {
            if (typeof promptData === 'object' && promptData !== null && 'value' in promptData) {
              // Ya está en formato completo, preservarlo
              promptValuesOnly[promptId] = {
                label: promptData.label || promptId,
                value: promptData.value,
                order: promptData.order ?? 999
              };
            } else {
              // Valor simple, crear objeto completo
              promptValuesOnly[promptId] = {
                label: promptId,
                value: promptData,
                order: 999
              };
            }
            console.log(`  📌 Loaded prompt ${promptId}:`, promptValuesOnly[promptId]);
          });
        }
        console.log('✅ Prompts guardados preservados con labels:', promptValuesOnly);
      }
      
      setPromptValues(promptValuesOnly);
      setDebouncedPromptValues(promptValuesOnly);
      setItemDescription(initialData.itemDescription || "");
      
      // Handle custom product initialization
      if (initialData.productId === CUSTOM_PRODUCT_ID) {
        console.log('✅ Inicializando producto personalizado');
        // Extract custom fields from synthetic prompts
        const qtyPrompt = promptValuesOnly['custom_quantity'];
        const pricePrompt = promptValuesOnly['custom_unit_price'];
        if (qtyPrompt) setCustomQuantity(Number(qtyPrompt.value) || 1);
        if (pricePrompt) setCustomPrice(Number(pricePrompt.value) || 0);
        setIsNewProduct(false);
      } else {
        // Marcar como NO nuevo si tiene prompts guardados
        const hasPromptsData = Object.keys(promptValuesOnly).length > 0;
        if (hasPromptsData) {
          console.log('✅ Artículo guardado detectado con', Object.keys(promptValuesOnly).length, 'prompts');
          console.log('🎯 Se hará PATCH con estos valores guardados para recalcular outputs y precio');
          setIsNewProduct(false);
          // NO marcar userHasChangedCurrentProduct aquí, eso se hará después del PATCH inicial
        }
      }
      
      // Solo marcar hasInitialOutputs si hay outputs guardados
      const hasOutputsData = initialData.outputs && Array.isArray(initialData.outputs) && initialData.outputs.length > 0;
      
      if (hasOutputsData) {
        console.log('✅ Initial outputs found, will use saved outputs but refresh pricing');
        setHasInitialOutputs(true);
      } else {
        console.log('⚠️ Missing outputs, will fetch everything from API');
        setHasInitialOutputs(false);
      }
      
      // Convertir formato antiguo a nuevo si es necesario
      const additionals = initialData.itemAdditionals;
      if (additionals && !Array.isArray(additionals)) {
        // Formato antiguo: objeto con ids como keys
        const converted = Object.entries(additionals).map(([id, config]: [string, any]) => ({
          id,
          name: `Ajuste ${id}`,
          type: "net_amount",
          value: config.value || 0,
          isCustom: true
        }));
        setItemAdditionals(converted);
      } else {
        setItemAdditionals(Array.isArray(additionals) ? additionals : []);
      }
      const m: any = initialData.multi;
      if (m) {
        setMultiEnabled(true);
        if (m.qtyPrompt) setQtyPrompt(m.qtyPrompt);
        if (Array.isArray(m.qtyInputs)) {
          setQtyInputs(m.qtyInputs);
          setQtyCount(Math.max(1, Math.min(MAX_QTY, m.qtyInputs.length)));
        }
      }
      // Activar recálculo automático si es una duplicación
      if (initialData.needsRecalculation) {
        setForceRecalculate(true);
      }
    } catch {}
  }, [initialData]);

  // Capture initial state for change detection
  useEffect(() => {
    if (initialStateRef.current === "" && isExpanded) {
      initialStateRef.current = JSON.stringify({
        productId,
        promptValues,
        itemDescription,
        itemAdditionals,
        multiEnabled,
        qtyPrompt,
        qtyInputs
      });
    }
  }, [isExpanded, productId, promptValues, itemDescription, itemAdditionals, multiEnabled, qtyPrompt, qtyInputs]);

  // Detect changes
  useEffect(() => {
    if (initialStateRef.current && isExpanded) {
      const currentState = JSON.stringify({
        productId,
        promptValues,
        itemDescription,
        itemAdditionals,
        multiEnabled,
        qtyPrompt,
        qtyInputs
      });
      setHasUnsavedChanges(currentState !== initialStateRef.current);
    }
  }, [productId, promptValues, itemDescription, itemAdditionals, multiEnabled, qtyPrompt, qtyInputs, isExpanded]);

  // This duplicate reset is handled by the more sophisticated useEffect below (lines 291-320)
  // that uses previousProductIdRef to detect real product changes

  // Debounce promptValues changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Cancelar timer anterior si existe
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    const t = setTimeout(() => {
      console.log("⏱️ Debounce: actualizando debouncedPromptValues", promptValues);
      setDebouncedPromptValues(promptValues);
    }, 350);
    
    debounceTimerRef.current = t;
    return () => clearTimeout(t);
  }, [promptValues]);

  const fetchProducts = async (): Promise<any[]> => {
    const token = sessionStorage.getItem("easyquote_token");
    if (!token) throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
    
    const { data, error } = await invokeEasyQuoteFunction("easyquote-products", { token });
    
    if (error) throw error;
    
    const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
    // Filtrar solo productos activos (backup en frontend)
    const activeProducts = list.filter((product: any) => {
      console.log(`Product ${product.productName}: isActive=${product.isActive}`);
      return product.isActive === true;
    });
    console.log(`QuoteItem fetchProducts: Filtered ${activeProducts.length} active products from ${list.length} total`);
    return activeProducts as any[];
  };

  const getProductLabel = (p: any) =>
    p?.name ?? p?.title ?? p?.displayName ?? p?.productName ?? p?.product_name ?? p?.nombre ?? p?.Nombre ?? p?.description ?? "Producto sin nombre";

  const { data: products } = useQuery({
    queryKey: ["easyquote-products"],
    queryFn: fetchProducts,
    retry: 1,
    enabled: !!hasToken,
  });

  // Auto-fill product description cuando se selecciona un producto se maneja en el useEffect principal (líneas 712-722)

  const { data: additionals } = useQuery({
    queryKey: ["additionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Additional[];
    },
  });

  // Los prompts siempre vienen de easyquote-pricing (ya no usamos master-files)

  // Query principal de pricing
  const { data: pricing, error: pricingError, refetch: refetchPricing, isError: isPricingError, isFetching: isPricingLoading } = useQuery({
    queryKey: ["easyquote-pricing", productId, debouncedPromptValues, forceRecalculate, isNewProduct],
    enabled: (() => {
      // Verificar condiciones básicas
      if (!hasToken || !productId) {
        console.log("❌ Query disabled: missing token or productId");
        return false;
      }
      
      // Productos personalizados no usan la API de EasyQuote
      if (productId === "__CUSTOM_PRODUCT__") {
        console.log("❌ Query disabled: producto personalizado");
        return false;
      }
      
      // IMPORTANTE: Para productos NUEVOS, SIEMPRE permitir la query inicial (GET sin inputs)
      if (isNewProduct) {
        console.log("✅ Query enabled: producto nuevo, obteniendo prompts iniciales");
        return true;
      }
      
      // Para productos NO nuevos, requerir prompts
      if (!debouncedPromptValues || Object.keys(debouncedPromptValues).length === 0) {
        console.log("❌ Query disabled: no prompts para producto cargado");
        return false;
      }
      
      // Si hay initialData (artículo guardado), hacer query inicial para obtener prompts
      if (initialData) {
        // Permitir la primera carga para obtener las definiciones de los prompts
        if (!hasPerformedInitialLoad) {
          console.log("✅ Query enabled: primera carga de artículo guardado para obtener definiciones de prompts");
          return true;
        }
        // Después de la primera carga, solo hacer query si el usuario ha hecho cambios
        if (!userHasChangedCurrentProduct && !forceRecalculate) {
          console.log("ℹ️ Query disabled: usando datos guardados, sin cambios del usuario");
          return false;
        }
        console.log("✅ Query enabled: usuario ha modificado el producto guardado");
        return true;
      }
      
      // Query normal para productos con prompts
      console.log("✅ Query enabled: producto con prompts");
      return true;
    })(),
    retry: false,
    placeholderData: isNewProduct ? undefined : keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: 0,
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      
      console.log("🔥 Fetching pricing for product:", productId);
      console.log("  - isNewProduct:", isNewProduct);
      console.log("  - userHasChangedCurrentProduct:", userHasChangedCurrentProduct);
      console.log("  - debouncedPromptValues:", debouncedPromptValues);

      // Helper para detectar si un ID es un GUID válido
      const isValidGuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      const requestBody: any = {
        token,
        productId
      };

      // Si NO es producto nuevo Y tenemos valores de prompts, SIEMPRE enviar PATCH (nunca GET para artículos guardados)
      const hasPromptValues = debouncedPromptValues && Object.keys(debouncedPromptValues).length > 0;
      console.log("  - hasPromptValues:", hasPromptValues);
      
      // Detectar si los IDs guardados son numéricos (corruptos) en lugar de GUIDs
      const promptIds = Object.keys(debouncedPromptValues || {});
      const hasInvalidIds = promptIds.length > 0 && promptIds.some(id => !isValidGuid(id));
      
      if (hasInvalidIds && hasPromptValues) {
        console.log("⚠️ Detectados IDs de prompts inválidos (numéricos), necesita remapeo por label");
        
        // Hacer GET primero para obtener las definiciones con GUIDs correctos
        const { data: definitions, error: defError } = await invokeEasyQuoteFunction("easyquote-pricing", {
          token,
          productId
        });
        
        if (defError) throw defError;
        
        if (definitions?.prompts && Array.isArray(definitions.prompts)) {
          console.log("📦 Definiciones de prompts obtenidas del GET:", definitions.prompts.length);
          
          // Crear mapa de label -> GUID
          const labelToGuid: Record<string, string> = {};
          definitions.prompts.forEach((p: any) => {
            const label = p.promptText || p.label || "";
            if (label && p.id) {
              labelToGuid[label.toLowerCase().trim()] = p.id;
            }
          });
          
          console.log("🗺️ Mapa label->GUID:", labelToGuid);
          
          // Remapear los valores guardados usando labels
          const remappedPrompts: Record<string, any> = {};
          Object.entries(debouncedPromptValues).forEach(([oldId, promptData]) => {
            const label = (promptData && typeof promptData === 'object' && promptData.label) 
              ? promptData.label.toLowerCase().trim() 
              : "";
            const correctGuid = labelToGuid[label];
            
            if (correctGuid) {
              remappedPrompts[correctGuid] = promptData;
              console.log(`  ✅ Remapeado "${label}": ${oldId} -> ${correctGuid}`);
            } else {
              console.log(`  ⚠️ No se encontró GUID para label "${label}" (id original: ${oldId})`);
            }
          });
          
          // Actualizar promptValues con los IDs correctos
          if (Object.keys(remappedPrompts).length > 0) {
            console.log("✅ Actualizando promptValues con GUIDs correctos");
            setPromptValues(remappedPrompts);
            setDebouncedPromptValues(remappedPrompts);
            
            // Construir inputs con los GUIDs correctos
            const norm: Record<string, any> = {};
            Object.entries(remappedPrompts).forEach(([k, v]) => {
              const actualValue = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
              if (actualValue === "" || actualValue === undefined || actualValue === null) return;
              if (typeof actualValue === "string") {
                const trimmed = actualValue.trim();
                const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
                if (isHex) {
                  norm[k] = trimmed.slice(1).toUpperCase();
                  return;
                }
                const num = Number(trimmed.replace(",", "."));
                if (!Number.isNaN(num) && /^-?\d+([.,]\d+)?$/.test(trimmed)) {
                  norm[k] = num;
                  return;
                }
                norm[k] = trimmed;
              } else {
                norm[k] = actualValue;
              }
            });
            
            const inputsArray = Object.entries(norm).map(([id, value]) => ({ id, value }));
            if (inputsArray.length > 0) {
              requestBody.inputs = inputsArray;
            }
            console.log("  📤 Enviando PATCH con inputs remapeados:", inputsArray);
          }
        }
        
        if (!userHasChangedCurrentProduct) {
          setUserHasChangedCurrentProduct(true);
        }
      } else if (!isNewProduct && hasPromptValues) {
        // SIEMPRE PATCH para artículos guardados, tanto en primera carga como en cambios
        console.log("💾 Artículo guardado - enviando PATCH con valores guardados");
        const norm: Record<string, any> = {};
        Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
          const actualValue = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
          if (actualValue === "" || actualValue === undefined || actualValue === null) return;
          if (typeof actualValue === "string") {
            const trimmed = actualValue.trim();
            const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
            if (isHex) {
              norm[k] = trimmed.slice(1).toUpperCase();
              return;
            }
            const num = Number(trimmed.replace(",", "."));
            if (!Number.isNaN(num) && /^-?\d+([.,]\d+)?$/.test(trimmed)) {
              norm[k] = num;
              return;
            }
            norm[k] = trimmed;
          } else {
            norm[k] = actualValue;
          }
        });
        const inputsArray = Object.entries(norm).map(([id, value]) => ({ id, value }));
        if (inputsArray.length > 0) {
          requestBody.inputs = inputsArray;
        }
        console.log("  📤 Enviando PATCH con inputs:", inputsArray);
        
        // Marcar que se hizo la primera carga si no estaba marcado
        if (!userHasChangedCurrentProduct) {
          console.log("✅ Primera carga completa, próximos cambios serán por usuario");
          setUserHasChangedCurrentProduct(true);
        }
      } else if (isNewProduct) {
        console.log("✨ Producto nuevo, haciendo GET para obtener configuración inicial");
      } else {
        console.log("⚠️ Artículo guardado pero sin prompts aún - esperando inicialización");
      }

      console.log("📤 Request body:", requestBody);

      // Usar solo la edge function para evitar errores con IDs incorrectos
      const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", requestBody);
      
      if (error) {
        if (error.status === 401 || error.code === 'EASYQUOTE_UNAUTHORIZED') {
          const { notifyUnauthorized } = await import('@/hooks/useTokenRefresh');
          notifyUnauthorized(401, 'EASYQUOTE_UNAUTHORIZED');
        }
        throw error;
      }
      
      // Inicializar promptValues con los datos del API SOLO si es un producto nuevo Y NO hay initialData
      // CRÍTICO: Si hay initialData, los prompts guardados son DEFINITIVOS y NO deben sobrescribirse
      if (isNewProduct && data?.prompts && !initialData) {
        console.log("✅ GET exitoso con prompts, marcando producto como cargado");
        console.log("📦 Prompts recibidos del API (GET inicial):", {
          productId,
          promptsCount: data.prompts.length,
          prompts: data.prompts.map((p: any) => ({
            id: p.id,
            label: p.promptText || p.label,
            type: p.promptType,
            currentValue: p.currentValue,
            order: p.promptSequence
          }))
        });
        
        // Bloquear sincronización durante inicialización
        setIsInitializing(true);
        
        // Inicializar promptValues con los valores por defecto del API
        const defaultValues: Record<string, any> = {};
        data.prompts.forEach((prompt: any) => {
          if (prompt.id && prompt.currentValue !== undefined && prompt.currentValue !== null) {
            defaultValues[prompt.id] = {
              label: prompt.promptText || prompt.label || prompt.id,
              value: prompt.currentValue,
              order: prompt.promptSequence ?? prompt.order ?? 999
            };
            console.log(`  📌 Inicializando ${prompt.id} = ${prompt.currentValue}`);
          }
        });
        
        if (Object.keys(defaultValues).length > 0) {
          console.log("✅ Estableciendo valores iniciales en promptValues:", defaultValues);
          setPromptValues(defaultValues);
          setDebouncedPromptValues(defaultValues);
          
          // Desbloquear sincronización después de un tick para asegurar que React actualizó el estado
          setTimeout(() => {
            console.log("✅ Desbloqueando sincronización después de inicialización");
            setIsInitializing(false);
          }, 0);
        }
        
        setIsNewProduct(false);
      } else if (isNewProduct && initialData) {
        // Si hay initialData pero isNewProduct es true, corregir el flag sin sobrescribir prompts
        console.log("⚠️ Artículo guardado detectado con isNewProduct=true, corrigiendo sin sobrescribir prompts");
        setIsNewProduct(false);
        setIsInitializing(false);
      }
      
      // NO sobrescribir promptValues después de PATCH - el usuario ya tiene los valores correctos localmente
      // Solo necesitamos la respuesta del API para outputs y precio, no para reemplazar los prompts
      if (!isNewProduct && data?.prompts) {
        console.log("🔄 Prompts recibidos del API (después de PATCH) - manteniendo valores locales del usuario:", {
          productId,
          promptsCount: data.prompts.length
        });
        setIsInitializing(false);
      }
      
      // Si obtuvimos nuevos outputs, desactivar hasInitialOutputs para que se usen los nuevos
      if (data?.outputValues && hasInitialOutputs) {
        console.log("✅ Nuevos outputs recibidos, desactivando hasInitialOutputs para usar datos actualizados");
        setHasInitialOutputs(false);
      }
      
      // Marcar que ya se realizó la carga inicial si había initialData
      if (initialData && !hasPerformedInitialLoad) {
        console.log("✅ Primera carga completada para artículo guardado");
        setHasPerformedInitialLoad(true);
      }
      
      return data;
    },
  });

  // Forzar recálculo cuando se activa el flag
  useEffect(() => {
    if (forceRecalculate && hasToken && productId) {
      refetchPricing();
      setForceRecalculate(false);
    }
  }, [forceRecalculate, hasToken, productId, refetchPricing]);

  // Inicializar/Fusionar TODOS los prompts del producto con los valores guardados
  useEffect(() => {
    if (!pricing?.prompts || !Array.isArray(pricing.prompts)) return;
    
    // Si NO hay initialData, inicializar con valores por defecto (producto nuevo)
    if (!initialData && isNewProduct && Object.keys(promptValues).length === 0) {
      console.log("🎨 Producto NUEVO - Inicializando promptValues con valores por defecto de pricing");
      const defaultValues: Record<string, any> = {};
      pricing.prompts.forEach((prompt: any) => {
        if (prompt.id && prompt.currentValue !== undefined && prompt.currentValue !== null) {
          defaultValues[prompt.id] = {
            label: prompt.promptText || prompt.label || prompt.id,
            value: prompt.currentValue,
            order: prompt.promptSequence ?? prompt.order ?? 999
          };
          console.log(`  📌 ${prompt.id} = ${prompt.currentValue}`);
        }
      });
      
      if (Object.keys(defaultValues).length > 0) {
        console.log("✅ Estableciendo valores iniciales:", defaultValues);
        setPromptValues(defaultValues);
        setDebouncedPromptValues(defaultValues);
      }
      return;
    }
    
    // Si HAY initialData, NO fusionar prompts del API - los guardados son los DEFINITIVOS
    // La fusión causaba que se añadieran todos los prompts del producto a los datos guardados
    // corrompiendo los datos que el usuario había configurado originalmente
    if (initialData && hasPerformedInitialLoad && Object.keys(promptValues).length > 0) {
      console.log("✅ Artículo guardado - usando prompts DEFINITIVOS guardados, sin fusionar con API");
      console.log("   Prompts guardados:", Object.keys(promptValues).length);
    }
  }, [pricing, isNewProduct, initialData, promptValues, hasPerformedInitialLoad]);

  // Track if prompts were initialized from saved data
  const previousProductIdRef = useRef<string>("");
  const hasMarkedAsLoadedRef = useRef<boolean>(false);
  
  // Reset ALL states when product changes - complete clean slate
  useEffect(() => {
    // Only reset if product actually changed (not initial load)
    if (previousProductIdRef.current && previousProductIdRef.current !== productId) {
      console.log("🔄 Producto cambió - RESET COMPLETO de todos los estados", { from: previousProductIdRef.current, to: productId });
      
      // Cancelar cualquier debounce pendiente
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      
      // Reset EVERYTHING to initial state
      setPromptValues({});
      setDebouncedPromptValues({});
      setMultiEnabled(false);
      setQtyPrompt("");
      setQtyInputs(["", "", "", "", ""]);
      setItemAdditionals([]);
      setItemDescription("");
      setIsNewProduct(true);
      setHasInitialOutputs(false);
      setForceRecalculate(false);
      setHasUnsavedChanges(false);
      setUserHasChangedCurrentProduct(false); // Reset flag para nuevo producto
      setHasPerformedInitialLoad(false); // Reset flag para carga inicial
      hasMarkedAsLoadedRef.current = false;
      
      console.log("✅ Estados reseteados completamente, listo para cargar nuevo producto");
    }
    previousProductIdRef.current = productId;
    
    // Auto-fill product description when product is selected
    if (productId && products) {
      const selectedProduct = products.find((p: any) => String(p.id) === String(productId));
      if (selectedProduct) {
        const productLabel = getProductLabel(selectedProduct);
        // Only auto-fill if description is empty
        if (!itemDescription) {
          setItemDescription(productLabel);
        }
      }
    }
    
    // Auto-expand when a product is selected for the first time - pero solo si shouldExpand no está definido o es true
    if (productId && !isExpanded && shouldExpand !== false && !userCollapsed) {
      setIsExpanded(true);
    }
  }, [productId, products, shouldExpand, userCollapsed]);

  // Auto-expand when component mounts without a product - pero solo si shouldExpand no está definido o es true
  useEffect(() => {
    if (!productId && shouldExpand !== false) {
      setIsExpanded(true);
    }
  }, []);

  // Derive prompts and outputs
  const outputs = useMemo(() => {
    // Si hay outputs guardados Y NO hemos hecho ningún cambio aún, usarlos
    if (hasInitialOutputs && initialData?.outputs && !pricing?.outputValues) {
      return initialData.outputs;
    }
    // Una vez que pricing tiene datos (después de GET o PATCH), usar esos
    return Array.isArray((pricing as any)?.outputValues) ? (pricing as any).outputValues : [];
  }, [pricing, hasInitialOutputs, initialData]);
  const imageOutputs = useMemo(
    () => outputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? ""))),
    [outputs]
  );
  const priceOutput = useMemo(
    () => outputs.find((o: any) => String(o?.type || "").toLowerCase() === "price"),
    [outputs]
  );
  const otherOutputs = useMemo(
    () =>
      outputs.filter((o: any) => {
        const t = String(o?.type || "").toLowerCase();
        const n = String(o?.name || "").toLowerCase();
        const v = String(o?.value ?? "");
        const isImageLike = t.includes("image") || n.includes("image");
        const isNA = v === "" || v === "#N/A";
        return o !== priceOutput && !isImageLike && !isNA;
      }),
    [outputs, priceOutput]
  );

  const { data: multiResults, isFetching: multiLoading } = useQuery({
    queryKey: ["easyquote-multi", productId, debouncedPromptValues, qtyPrompt, qtyInputs, multiEnabled],
    enabled: !!hasToken && !!productId && multiEnabled && !!qtyPrompt && qtyInputs.some((q) => q && q.trim() !== ""),
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      const norm: Record<string, any> = {};
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        // Extract actual value if it's stored as {label, value}
        const actualValue = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
        
        if (actualValue === "" || actualValue === undefined || actualValue === null) return;
        if (typeof actualValue === "string") {
          const trimmed = actualValue.trim();
          const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
          if (isHex) {
            norm[k] = trimmed.slice(1).toUpperCase();
            return;
          }
          const num = Number(trimmed.replace(",", "."));
          if (!Number.isNaN(num) && /^-?\d+([.,]\d+)?$/.test(trimmed)) {
            norm[k] = num;
            return;
          }
          norm[k] = trimmed;
        } else {
          norm[k] = actualValue;
        }
      });

      const qtys = qtyInputs
        .map((q) => Number(String(q).replace(/\./g, "").replace(",", ".")))
        .filter((n) => !Number.isNaN(n));
      if (qtys.length === 0) return [] as any[];
      const list = Object.entries(norm).map(([id, value]) => ({ id, value }));
      const results = await Promise.all(
        qtys.map(async (qty) => {
          const replaced = list.filter((it) => it.id !== qtyPrompt).concat([{ id: qtyPrompt, value: qty }]);
          const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
            token,
            productId,
            inputs: replaced
          });
          
          if (error) throw error;
          return { qty, data };
        })
      );
      return results;
    },
  });

  // Numeric prompts detection
  const numericPrompts = useMemo(() => {
    const p: any = pricing as any;
    const arr: any[] = Array.isArray(p?.prompts) ? p.prompts : [];
    return arr
      .filter((sp: any) => {
        const hasOptions = Array.isArray(sp?.valueOptions) && sp.valueOptions.length > 0;
        if (hasOptions) return false;
        const t = String(sp?.promptType || "").toLowerCase();
        if (t.includes("number")) return true;
        const cv = sp?.currentValue ?? sp?.default ?? sp?.value;
        return typeof cv === "number";
      })
      .map((sp: any) => ({ id: String(sp.id), label: sp.promptText ?? sp.name ?? sp.id }));
  }, [pricing]);

  useEffect(() => {
    if (!qtyPrompt && numericPrompts.length > 0) setQtyPrompt(numericPrompts[0].id);
  }, [numericPrompts, qtyPrompt]);

  // Always sync Q1 with the selected qtyPrompt field value
  useEffect(() => {
    if (!qtyPrompt) return;
    
    // Get current value from promptValues or from pricing defaults
    let currentRaw = (promptValues as any)[qtyPrompt];
    // Extract actual value if it's stored as {label, value}
    let current = (currentRaw && typeof currentRaw === 'object' && 'value' in currentRaw) ? currentRaw.value : currentRaw;
    
    // If not in promptValues, try to get it from pricing prompts defaults
    if ((current === undefined || current === null || String(current).trim() === "") && pricing) {
      const prompts = (pricing as any)?.prompts || [];
      const prompt = prompts.find((p: any) => String(p.id) === String(qtyPrompt));
      if (prompt) {
        current = prompt.currentValue ?? prompt.default ?? prompt.defaultValue ?? prompt.value;
      }
    }
    
    // Automatically populate Q1 with the current value of the selected field
    if (current !== undefined && current !== null && String(current).trim() !== "") {
      const asStr = String(current);
      setQtyInputs((prev) => {
        const next = [...prev];
        next[0] = asStr;
        return next;
      });
    }
  }, [qtyPrompt, promptValues, pricing]);

  // Adjust qty inputs length
  useEffect(() => {
    setQtyInputs((prev) => {
      if (qtyCount > prev.length) return prev.concat(Array(qtyCount - prev.length).fill(""));
      if (qtyCount < prev.length) return prev.slice(0, qtyCount);
      return prev;
    });
  }, [qtyCount]);

  const prompts = extractPrompts(pricing);

  const formatEUR = (val: any) => {
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) return `${String(val)} €`;
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const multiRows = useMemo(() => {
    const rows = (multiResults as any[] | undefined) || [];
    return rows.map((r: any) => {
      const outs: any[] = Array.isArray(r?.data?.outputValues) ? r.data.outputValues : [];
      const priceOut = outs.find(
        (o: any) => String(o?.type || "").toLowerCase() === "price" || String(o?.name || "").toLowerCase().includes("precio") || String(o?.name || "").toLowerCase().includes("price")
      );
      const totalStr = priceOut?.value ?? "";
      const totalNum = typeof totalStr === "number" ? totalStr : parseFloat(String(totalStr).replace(/\./g, "").replace(",", "."));
      const unit = r.qty > 0 && !Number.isNaN(totalNum) ? totalNum / r.qty : NaN;
      return { qty: r.qty, outs, totalStr, unit };
    });
  }, [multiResults]);

  // Calculate final price with additionals
  const finalPrice = useMemo(() => {
    // For custom products, use customPrice * customQuantity
    if (isCustomProduct) {
      let basePrice = customPrice * customQuantity;
      let additionalsTotal = 0;
      
      if (Array.isArray(itemAdditionals)) {
        itemAdditionals.forEach((additional) => {
          if (additional.type === 'net_amount') {
            additionalsTotal += additional.value;
          } else if (additional.type === 'quantity_multiplier') {
            additionalsTotal += additional.value * customQuantity;
          }
        });
      }
      
      return basePrice + additionalsTotal;
    }
    
    // For API products, use priceOutput
    const basePrice = parseFloat(String((priceOutput as any)?.value ?? 0).replace(/\./g, "").replace(",", ".")) || 0;
    let additionalsTotal = 0;
    
    if (Array.isArray(itemAdditionals)) {
      itemAdditionals.forEach((additional) => {
        if (additional.type === 'net_amount') {
          additionalsTotal += additional.value;
        } else if (additional.type === 'quantity_multiplier') {
          // For quantity type, we need to get the quantity from prompts or multi
          const quantity = multiEnabled && multiRows.length > 0 ? 
            multiRows.reduce((sum, row) => sum + row.qty, 0) : 1;
          additionalsTotal += additional.value * quantity;
        }
      });
    }
    
    return basePrice + additionalsTotal;
  }, [priceOutput, itemAdditionals, multiEnabled, multiRows, isCustomProduct, customPrice, customQuantity]);

  // This useEffect is now redundant - removed to prevent duplicate onChange calls

  // Extract all prompts from product with their defaults
  const extractAllPrompts = (product: any): Record<string, { label: string; value: any; order: number }> => {
    const candidates = [
      product?.prompts,
      product?.inputs,
      product?.fields,
      product?.parameters,
      product?.config?.prompts,
      product?.schema?.prompts,
      product?.pricing?.prompts,
      product?.pricing?.inputs,
      product?.form?.fields,
      product?.form?.prompts,
      product?.options,
      product?.choices,
      product?.data?.prompts,
      product?.request?.fields,
    ];
    const raw: any[] = (candidates.find((r) => Array.isArray(r)) as any[]) || [];
    
    const result: Record<string, { label: string; value: any; order: number }> = {};
    
    raw.forEach((f: any, idx: number) => {
      const id = String(f.id ?? f.key ?? f.code ?? f.slug ?? f.name ?? `field_${idx}`);
      const label = f.promptText ?? f.label ?? f.title ?? f.promptName ?? f.displayName ?? f.text ?? f.caption ?? f.name ?? id;
      // Usar promptSequence de EasyQuote API como orden principal
      const order = Number.isFinite(Number(f.promptSequence)) ? Number(f.promptSequence) : (Number.isFinite(Number(f.order)) ? Number(f.order) : idx);
      
      // Get default value
      const options = f.valueOptions ?? f.options ?? f.choices ?? f.values ?? f.items ?? f.optionsList ?? [];
      const defaultFromIndex = (Number.isFinite(Number(f.defaultIndex)) && options[Number(f.defaultIndex)]) 
        ? options[Number(f.defaultIndex)].value 
        : undefined;
      let defaultVal = f.currentValue ?? f.default ?? f.defaultValue ?? f.initial ?? f.value ?? f.defaultOption?.value ?? defaultFromIndex;
      
      // Normalize color values
      const rawType = String(f.promptType ?? f.type ?? f.inputType ?? f.kind ?? f.uiType ?? "text").toLowerCase();
      if ((rawType.includes("color")) && typeof defaultVal === "string" && /^[0-9a-f]{6}$/i.test(defaultVal)) {
        defaultVal = `#${defaultVal.toUpperCase()}`;
      }
      
      // Always add with order, even if no default value (to preserve order for all prompts)
      result[id] = { label, value: defaultVal ?? '', order };
    });
    
    return result;
  };

  // Los valores ya se cargan desde initialData (líneas 110-145)
  // No se necesita useEffect adicional que sobrescriba valores guardados

  const handlePromptChange = (id: string, value: any, label: string) => {
    console.log("🔄 Usuario cambió prompt:", { id, value, label });
    
    // Marcar que el usuario ha cambiado valores del producto actual
    setUserHasChangedCurrentProduct(true);
    
    setPromptValues((prev) => {
      let order = prev[id]?.order;
      
      if (order === undefined && pricing) {
        const prompts = (pricing as any)?.prompts || [];
        const promptDef = prompts.find((p: any) => String(p.id) === String(id));
        if (promptDef) {
          order = Number.isFinite(Number(promptDef.promptSequence)) 
            ? Number(promptDef.promptSequence) 
            : (Number.isFinite(Number(promptDef.order)) ? Number(promptDef.order) : prompts.indexOf(promptDef));
        }
      }
      
      return {
        ...prev, 
        [id]: { 
          label, 
          value,
          order: order !== undefined ? order : 999
        } 
      };
    });
  };

  // Sync with parent only on specific user actions, not automatically
  const syncToParent = useCallback(() => {
    if (!onChange) return;
    
    // NO sincronizar durante la inicialización
    if (isInitializing) {
      console.log('⏸️ syncToParent bloqueado durante inicialización');
      return;
    }
    
    // NO sincronizar si se está calculando el precio (evita guardar datos incompletos)
    if (isPricingLoading) {
      console.log('⏸️ syncToParent bloqueado: precio recalculándose');
      return;
    }
    
    // Para productos de API, verificar que haya prompts antes de sincronizar
    if (!isCustomProduct && Object.keys(promptValues).length === 0) {
      console.log('⏸️ syncToParent bloqueado: sin prompts para producto de API');
      return;
    }
    
    console.log('🔄 syncToParent ejecutándose:', {
      productId,
      isCustomProduct,
      promptValuesKeys: Object.keys(promptValues),
      promptValuesCount: Object.keys(promptValues).length,
      promptValues,
      hasOutputs: outputs && outputs.length > 0
    });
    
    let promptsArray: any[] = [];
    
    // For custom products, create synthetic prompts for quantity and price
    if (isCustomProduct) {
      promptsArray = [
        { id: 'custom_quantity', label: 'Cantidad', value: customQuantity, order: 1 },
        { id: 'custom_unit_price', label: 'Precio unitario', value: customPrice, order: 2 }
      ];
    } else {
      // Extraer las definiciones de prompts del producto para obtener reglas de visibilidad
      const promptDefs = extractPrompts(pricing as any);
      
      // Convertir promptValues a formato Record para evaluar visibilidad
      const currentValues: Record<string, any> = {};
      Object.entries(promptValues).forEach(([id, promptData]) => {
        const value = (typeof promptData === 'object' && promptData !== null && 'value' in promptData) 
          ? promptData.value 
          : promptData;
        currentValues[id] = value;
      });
      
      // Guardar TODOS los prompts sin filtros
      Object.entries(promptValues).forEach(([id, promptData]) => {
        // promptData puede ser un objeto {label, value, order} o un valor simple
        if (typeof promptData === 'object' && promptData !== null && 'value' in promptData) {
          const value = promptData.value;
          
          promptsArray.push({
            id,
            label: promptData.label || id,
            value: promptData.value,
            order: promptData.order ?? 999
          });
        } else {
          // Valor simple (fallback) - guardar sin filtrar
          promptsArray.push({
            id,
            label: id,
            value: promptData,
            order: 999
          });
        }
      });
    }
    
    const snapshot = {
      productId,
      prompts: promptsArray,
      outputs: isCustomProduct ? [] : outputs,
      price: finalPrice,
      multi: multiEnabled ? { qtyPrompt, qtyInputs, rows: multiRows } : null,
      itemDescription: itemDescription || (isCustomProduct ? "Artículo personalizado" : (products?.find((p: any) => String(p.id) === String(productId)) ? getProductLabel(products.find((p: any) => String(p.id) === String(productId))) : "")),
      itemAdditionals,
      isFinalized: initialData?.isFinalized,
    };
    
    const snapshotString = JSON.stringify(snapshot);
    if (snapshotString !== lastSyncedSnapshot.current) {
      lastSyncedSnapshot.current = snapshotString;
      console.log('✅ Sincronizando snapshot al padre:', {
        promptsCount: promptsArray.length,
        snapshotPreview: { ...snapshot, prompts: promptsArray.slice(0, 3) }
      });
      onChange(id, snapshot);
    } else {
      console.log('⏭️ Snapshot sin cambios, no sincronizando');
    }
  }, [id, onChange, productId, promptValues, outputs, finalPrice, multiEnabled, qtyPrompt, qtyInputs, multiRows, itemDescription, itemAdditionals, products, initialData?.isFinalized, isInitializing, isCustomProduct, customPrice, customQuantity, pricing, isPricingLoading]);

  // Verificar que el artículo está completo Y no se está recalculando el precio
  const isCalculating = isPricingLoading || multiLoading;
  const isComplete = productId && !isCalculating && ((isCustomProduct && customPrice > 0 && itemDescription) || (priceOutput && finalPrice > 0));

  // Sincronizar automáticamente cuando cambien los prompts o campos personalizados (excepto durante inicialización o cálculo)
  useEffect(() => {
    if (!isInitializing && !isPricingLoading && productId) {
      // Para productos personalizados, sincronizar cuando cambien los campos
      if (isCustomProduct && itemDescription) {
        console.log('🔄 Auto-sincronizando cambios de producto personalizado');
        syncToParent();
      }
      // Para productos de API, sincronizar cuando cambien los prompts Y haya datos
      else if (!isCustomProduct && Object.keys(promptValues).length > 0) {
        console.log('🔄 Auto-sincronizando cambios de prompts');
        syncToParent();
      }
    }
  }, [promptValues, isInitializing, productId, syncToParent, isCustomProduct, itemDescription, customPrice, customQuantity, isPricingLoading]);

  // Debug logging para el botón Finalizar
  useEffect(() => {
    console.log("🔍 Estado de finalización:", {
      productId: !!productId,
      priceOutput: !!priceOutput,
      finalPrice,
      isComplete,
      outputsLength: outputs.length
    });
  }, [productId, priceOutput, finalPrice, isComplete, outputs]);

  return (
    <>
    <div className={`border rounded-lg p-2 ${isExpanded ? 'border-r-4 border-r-primary' : 'border-r-4 border-r-secondary'}`}>
      {/* Collapsed view - simple line with action buttons */}
      {isComplete && !isExpanded ? (
        <div className="flex items-center justify-between py-1 hover:bg-muted/30 transition-colors rounded">
          <span className="text-base font-medium text-muted-foreground">
            {itemDescription}
            {multiEnabled && <span className="text-sm text-muted-foreground/70 ml-2">(cantidad múltiple activada)</span>}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold">{formatEUR(finalPrice)}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUserCollapsed(false); // Resetear flag de colapso manual
                  setIsExpanded(true);
                }}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(id)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Action buttons in top-right corner when editing */}
          {isExpanded && onFinishEdit && (
            <div className="flex flex-col gap-2 float-right ml-4 mb-2">
              <Button 
                onClick={() => {
                  // Sincronizar cambios antes de finalizar
                  syncToParent();
                  // Marcar como colapsado manualmente por el usuario
                  setUserCollapsed(true);
                  // Colapsar el item
                  setIsExpanded(false);
                  if (onFinishEdit) {
                    onFinishEdit(id);
                  }
                }}
                size="sm" 
                variant="default"
                disabled={!isComplete || isCalculating}
                className="whitespace-nowrap bg-primary hover:bg-primary/90"
              >
                {isCalculating ? "Calculando..." : "Finalizar producto"}
              </Button>
              {onRemove && (
                <Button
                  onClick={() => onRemove(id)}
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 whitespace-nowrap"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
          )}

          {/* Expanded view - show all fields */}
          {isComplete && !onFinishEdit && (
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setUserCollapsed(true); // Marcar como colapsado manualmente
                  setIsExpanded(false);
                }}
              >
                <ChevronUp className="w-4 h-4 mr-2" />
                Contraer
              </Button>
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="space-y-2">
              <Label>Selecciona producto</Label>
              <Select onValueChange={(value) => {
                console.log("🔄 Usuario cambió de producto:", value);
                setProductId(value);
                if (value === CUSTOM_PRODUCT_ID) {
                  setItemDescription("Artículo personalizado");
                  setCustomPrice(0);
                  setCustomQuantity(1);
                }
                // El reset completo lo maneja el useEffect de líneas 365-405
              }} value={productId} disabled={!!initialData?.productId}>
                <SelectTrigger ref={selectRef}>
                  <SelectValue placeholder={initialData?.productId ? "No se puede cambiar el producto" : "Elige un producto"} />
                </SelectTrigger>
                <SelectContent>
                  {/* Custom product option always first */}
                  <SelectItem value={CUSTOM_PRODUCT_ID} className="border-b">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Artículo personalizado</span>
                    </div>
                  </SelectItem>
                  {/* EasyQuote products */}
                  {hasToken && products?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{getProductLabel(p)}</SelectItem>
                  ))}
                  {!hasToken && (
                    <SelectItem value="" disabled>Conecta EasyQuote para más productos</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {initialData?.productId && (
                <p className="text-xs text-muted-foreground">Para cambiar el producto, elimina este artículo y crea uno nuevo.</p>
              )}
            </div>

            {productId && !isCustomProduct && (
              <div className="space-y-2 md:col-span-2">
                <Label>Nombre a mostrar del producto</Label>
                <Input
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Editar nombre del producto..."
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Expandable content - only show when expanded */}
      {productId && isExpanded && (
        <div className="grid gap-6 md:grid-cols-5">
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>{isCustomProduct ? "Configuración" : "Opciones"}</CardTitle>
            </CardHeader>
            <CardContent>
              {isCustomProduct ? (
                /* Custom product fields */
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="custom-description">Descripción</Label>
                    <Textarea
                      id="custom-description"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="Describe el artículo..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="custom-quantity" className="text-xs">Cantidad</Label>
                      <Input
                        id="custom-quantity"
                        type="number"
                        min="1"
                        value={customQuantity}
                        onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-price" className="text-xs">Precio (€)</Label>
                      <Input
                        id="custom-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                </div>
              ) : isPricingError && pricingError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error al cargar este producto</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>Este producto tiene problemas de configuración en EasyQuote.</p>
                    <p className="text-xs text-muted-foreground">
                      {pricingError instanceof Error ? pricingError.message : "Error desconocido"}
                    </p>
                    <p className="font-semibold">Por favor, selecciona otro producto o contacta al administrador.</p>
                  </AlertDescription>
                </Alert>
              ) : pricing ? (
                <PromptsForm product={pricing} values={promptValues} onChange={handlePromptChange} showAllPrompts={!!initialData} />
              ) : (
                <p className="text-sm text-muted-foreground">Cargando prompts…</p>
              )}
            </CardContent>
          </Card>

          <div className="md:col-span-2 md:sticky md:top-6 self-start space-y-3">
            {!isCustomProduct && isPricingError && pricingError && (
              <Alert variant="destructive">
                <AlertTitle>Producto no disponible</AlertTitle>
                <AlertDescription>
                  Este producto no puede ser usado actualmente. Selecciona otro de la lista.
                </AlertDescription>
              </Alert>
            )}
            {!isCustomProduct && imageOutputs.length > 0 && (
              <section className={imageOutputs.length === 1 ? "flex justify-center" : "grid grid-cols-2 gap-3"}>
                {imageOutputs.map((o: any, idx: number) => (
                  <img 
                    key={`${o.value}-${idx}`}
                    src={String(o.value)} 
                    alt={`resultado imagen ${idx + 1}`} 
                    loading="lazy" 
                    className={imageOutputs.length === 1 ? "max-w-[180px] w-full h-auto rounded-md" : "w-full h-auto rounded-md"}
                  />
                ))}
              </section>
            )}

            <Card className="border-accent/50 bg-muted/50">
              <CardHeader>
                <CardTitle>Resultado</CardTitle>
              </CardHeader>
              <CardContent>
                {isCustomProduct ? (
                  /* Custom product price display */
                  <div className="p-3 rounded-md border bg-card/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precio total</span>
                      <span className="px-2 py-1 rounded-full bg-accent text-accent-foreground text-lg font-semibold">
                        {formatEUR(finalPrice)}
                      </span>
                    </div>
                    {customQuantity > 1 && (
                      <div className="flex items-center justify-between mt-2 text-sm">
                        <span className="text-muted-foreground">{customQuantity} × {formatEUR(customPrice)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {pricingError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Producto sin pricing</AlertTitle>
                        <AlertDescription>El producto seleccionado no existe o es incorrecto.</AlertDescription>
                      </Alert>
                    )}

                    {priceOutput ? (
                      <div className="p-3 rounded-md border bg-card/50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Precio</span>
                          <span className="px-2 py-1 rounded-full bg-accent text-accent-foreground text-lg font-semibold">
                            {formatEUR((priceOutput as any).value)}
                          </span>
                        </div>
                      </div>
                    ) : (!pricingError && <p className="text-sm text-muted-foreground">Selecciona opciones para ver el resultado.</p>)}

                    {otherOutputs.length > 0 && (
                      <section className="space-y-2 mt-4">
                          {otherOutputs.map((o: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm px-1">
                              <span className="text-muted-foreground">{o.name ?? "Resultado"}</span>
                              <span className="truncate ml-2">{String(o.value)}</span>
                            </div>
                          ))}
                        </section>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {!hideMultiQuantities && !isCustomProduct && (
              <Card className="border-accent/50 bg-muted/30">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-base">Múltiples cantidades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Activar</Label>
                    </div>
                    <Switch checked={multiEnabled} onCheckedChange={setMultiEnabled} />
                  </div>

                  {multiEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label>Selecciona el campo a usar</Label>
                        <Select value={qtyPrompt} onValueChange={setQtyPrompt} disabled={numericPrompts.length === 0}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona prompt numérico" />
                          </SelectTrigger>
                          <SelectContent>
                            {numericPrompts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>¿Cuántos?</Label>
                        <Input
                          type="number"
                          min={1}
                          max={MAX_QTY}
                          value={qtyCount}
                          onChange={(e) => {
                            const n = parseInt(e.target.value || "0", 10);
                            if (Number.isNaN(n)) return;
                            setQtyCount(Math.max(1, Math.min(MAX_QTY, n)));
                          }}
                          className="w-20"
                        />
                      </div>

                      <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Q1</Label>
                          <Input
                            type="number"
                            min={1}
                            value={qtyInputs[0] ?? ""}
                            readOnly
                            className="bg-muted px-2"
                          />
                        </div>
                        {Array.from({ length: qtyCount - 1 }, (_, i) => i + 1).map((idx) => (
                          <div key={idx} className="space-y-1">
                            <Label className="text-xs">Q{idx + 1}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={qtyInputs[idx] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setQtyInputs((prev) => {
                                  const next = [...prev];
                                  next[idx] = v;
                                  return next;
                                });
                              }}
                              className="px-2"
                            />
                          </div>
                        ))}
                      </div>

                       {multiLoading ? (
                        <p className="text-sm text-muted-foreground">Calculando...</p>
                      ) : (Array.isArray(multiRows) && multiRows.length > 0 ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {multiRows.map((r, idx) => {
                              const priceOut = (r.outs || []).find((o:any)=> String(o?.type||'').toLowerCase()==='price' || String(o?.name||'').toLowerCase().includes('precio') || String(o?.name||'').toLowerCase().includes('price'));
                              const priceValue = typeof priceOut?.value === "number" ? priceOut.value : parseFloat(String(priceOut?.value).replace(/\./g, "").replace(",", "."));
                              const formattedPrice = !isNaN(priceValue) ? new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(priceValue) : "0,00";
                              return (
                                <div key={idx} className="border rounded p-2">
                                  <div className="text-xs text-muted-foreground mb-1">Q{idx + 1}</div>
                                  <div className="text-xs">{formattedPrice}</div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3">
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="detalles">
                                <AccordionTrigger>Detalles</AccordionTrigger>
                                <AccordionContent>
                                  <Tabs defaultValue="q1" className="w-full">
                                    <TabsList className="mb-3">
                                      {multiRows.map((_, idx) => (
                                        <TabsTrigger key={idx} value={`q${idx + 1}`}>Q{idx + 1}</TabsTrigger>
                                      ))}
                                    </TabsList>

                                    {multiRows.map((r, idx) => {
                                      const outs = r.outs || [];
                                      const priceOut = outs.find((o:any)=> String(o?.type||'').toLowerCase()==='price' || String(o?.name||'').toLowerCase().includes('precio') || String(o?.name||'').toLowerCase().includes('price'));
                                      const details = outs.filter((o:any) => {
                                        const t = String(o?.type || '').toLowerCase();
                                        const n = String(o?.name || '').toLowerCase();
                                        const v = String(o?.value ?? '');
                                        const isImageLike = t.includes('image') || n.includes('image');
                                        const isNA = v === '' || v === '#N/A';
                                        return o !== priceOut && !isImageLike && !isNA;
                                      });
                                      return (
                                        <TabsContent key={idx} value={`q${idx + 1}`}>
                                          <div className="p-3 rounded-md border bg-card/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm text-muted-foreground">Precio total</span>
                                              <span className="font-semibold">{formatEUR(priceOut?.value)}</span>
                                            </div>
                                            {details.length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                  {details.map((o:any, i:number) => (
                                                    <div key={i} className="flex items-center justify-between text-sm">
                                                      <span className="text-muted-foreground">{o.name ?? 'Dato'}</span>
                                                      <span>{String(o.value)}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                            )}
                                          </div>
                                        </TabsContent>
                                      );
                                    })}
                                  </Tabs>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Añade cantidades para ver precios.</p>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}


      {/* Additionals Section */}
      {productId && isExpanded && (
        <Card className="max-w-2xl mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Ajustes del artículo</CardTitle>
              {Array.isArray(itemAdditionals) && itemAdditionals.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {itemAdditionals.length} activos
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <AdditionalsSelector 
              selectedAdditionals={Array.isArray(itemAdditionals) ? itemAdditionals : []}
              onChange={setItemAdditionals}
            />
          </CardContent>
        </Card>
      )}
    </div>

    <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Salir sin guardar los cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            Has realizado cambios en este artículo que no se han guardado. ¿Deseas finalizar la edición sin guardar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            setShowExitConfirm(false);
            // Sincronizar cambios antes de salir
            syncToParent();
            onFinishEdit?.(id);
          }}>
            Salir sin guardar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
