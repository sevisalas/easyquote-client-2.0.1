import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
import ComponentTabsPromptsForm from "@/components/quotes/ComponentTabsPromptsForm";
import ComponentTabsOutputs from "@/components/quotes/ComponentTabsOutputs";
import BoundProductConfigSelector, { 
  type BoundProductConfig, 
  getAvailableConfigs, 
  getActiveComponents 
} from "@/components/quotes/BoundProductConfigSelector";
import CompositeComponentTabs, { type ComponentsDataMap } from "@/components/quotes/CompositeComponentTabs";
import CompositeComponentsSelector, { 
  type ActiveComponent, 
  getInitialActiveComponents, 
  hasRequiredComponents 
} from "@/components/quotes/CompositeComponentsSelector";
import { useProductComponentSettings } from "@/hooks/useProductComponentSettings";
import { useCompositeProductConfig } from "@/hooks/useCompositeProductConfig";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import AdditionalsSelector from "@/components/quotes/AdditionalsSelector";
import { ChevronDown, ChevronUp, Pencil, Trash2, Package } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSubscription } from "@/contexts/SubscriptionContext";
// Special product ID for custom/manual items
const CUSTOM_PRODUCT_ID = "__CUSTOM_PRODUCT__";

type ItemSnapshot = {
  productId: string;
  prompts: Record<string, any>;
  outputs: any[];
  price?: any;
  modifiedPrice?: number | null;  // Precio modificado por el usuario (null = usar calculado)
  multi?: any;
  needsRecalculation?: boolean;
  displayName?: string;  // Nombre a mostrar del producto (editable)
  itemDescription?: string;  // Descripción (para productos custom)
  productName?: string;  // Nombre original del producto API
  itemAdditionals?: any[];
  isFinalized?: boolean;
  boundProductConfig?: BoundProductConfig | null;  // Configuración de producto encuadernado
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
  // Get organization context for output ordering
  const { organization, membership, isSuperAdmin, isOrgAdmin } = useSubscription();
  const organizationId = organization?.id || membership?.organization_id;
  const apiUserId = organization?.api_user_id || (membership?.organization as any)?.api_user_id;
  const canEditPrice = isSuperAdmin || isOrgAdmin;
  const queryClient = useQueryClient();

  // Si el contexto aún no trae api_user_id (casos multi-org / impersonación), resolverlo por organizationId
  const { data: resolvedApiUserId, isLoading: isLoadingResolvedApiUserId } = useQuery({
    queryKey: ["organization-api-user-id", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("api_user_id")
        .eq("id", organizationId)
        .single();
      if (error) throw error;
      return data?.api_user_id ?? null;
    },
    enabled: !!organizationId && !apiUserId,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveApiUserId = apiUserId ?? resolvedApiUserId ?? null;
  const isApiUserIdPending = !!organizationId && !effectiveApiUserId && isLoadingResolvedApiUserId;

  // Debug: log apiUserId para verificar filtrado de componentes
  console.log('🔍 QuoteItem context:', { organizationId, apiUserId, resolvedApiUserId, effectiveApiUserId, orgName: organization?.name });

  // Local state per item
  const [productId, setProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [debouncedPromptValues, setDebouncedPromptValues] = useState<Record<string, any>>({});
  const [forceRecalculate, setForceRecalculate] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(shouldExpand === true); // Solo expandir si shouldExpand es explícitamente true
  const [userCollapsed, setUserCollapsed] = useState<boolean>(false); // Flag para colapso manual del usuario
  const [displayName, setDisplayName] = useState<string>(""); // Nombre a mostrar (editable)
  const [itemDescription, setItemDescription] = useState<string>(""); // Descripción (solo para productos custom)
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
  const [qtyInputs, setQtyInputs] = useState<string[]>(["", "", ""]); // Estado committed (dispara API) - Q1, Q2, Q3
  const [localQtyInputs, setLocalQtyInputs] = useState<string[]>(["", "", ""]); // Estado local mientras se escribe
  const MAX_QTY = 10;
  const [qtyCount, setQtyCount] = useState<number>(3); // Por defecto Q1, Q2, Q3
  const [multiModifiedPrices, setMultiModifiedPrices] = useState<Record<number, number | null>>({}); // Precios modificados por cantidad
  const [editingMultiPriceIdx, setEditingMultiPriceIdx] = useState<number | null>(null);
  const [localMultiPriceInput, setLocalMultiPriceInput] = useState("");

  // Item additionals
  const [itemAdditionals, setItemAdditionals] = useState<any[]>([]);

  // Custom product fields (when CUSTOM_PRODUCT_ID is selected)
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customQuantity, setCustomQuantity] = useState<number>(1);
  const isCustomProduct = productId === CUSTOM_PRODUCT_ID;
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [activeComponent, setActiveComponent] = useState<string>("cubierta");
  const [boundProductConfig, setBoundProductConfig] = useState<BoundProductConfig | null>(null);
  const [userEditedPrice, setUserEditedPrice] = useState<number | null>(null); // Precio editado por usuario
  const [forceResultPrompts, setForceResultPrompts] = useState<PromptDef[]>([]); // Prompts marcados como "Opc. restrictiva"
  const initialStateRef = useRef<string>("");
  
  // Estados para productos compuestos con componentes configurados (nuevo sistema)
  const [activeCompositeComponents, setActiveCompositeComponents] = useState<ActiveComponent[]>([]);
  const [compositeComponentsData, setCompositeComponentsData] = useState<ComponentsDataMap>({});
  const [compositeTotalPrice, setCompositeTotalPrice] = useState<number>(0);
  const [compositeParentOutputs, setCompositeParentOutputs] = useState<any[]>([]);
  const [componentPromptValues, setComponentPromptValues] = useState<Record<string, Record<string, any>>>({});
  
  // Cache de opciones de prompts: se cargan una vez por producto y no se recargan en cada PATCH
  const promptOptionsCache = useRef<Record<string, any[]>>({});
  
  // Obtener configuración de componentes del producto
  const { isComposite, enabledComponents } = useProductComponentSettings(productId || undefined, apiUserId);
  
  // Fetch composite product components configuration (nuevo sistema)
  const { 
    components: configuredComponents = [],
    componentsLoading: isLoadingConfiguredComponents,
  } = useCompositeProductConfig(productId || undefined, organizationId);
  
  // Nuevo sistema: si hay componentes configurados en composite_product_components, usar ese
  const hasConfiguredComponents = configuredComponents.length > 0;
  const hasRequiredComponentsConfigured = hasRequiredComponents(configuredComponents);
  
  // Handlers para cambios de prompts en componentes individuales
  const handleComponentPromptChange = useCallback((componentKey: string, promptId: string, value: any) => {
    setComponentPromptValues(prev => ({
      ...prev,
      [componentKey]: {
        ...(prev[componentKey] || {}),
        [promptId]: value,
      },
    }));
  }, []);

  const handleComponentPromptCommit = useCallback((componentKey: string, promptId: string, value: any) => {
    console.log("[QuoteItem] Component prompt committed:", { componentKey, promptId, value });
  }, []);
  
  // Determinar si el producto necesita selector de configuración (tiene múltiples componentes)
  const availableConfigs = useMemo(() => {
    // Si tiene el nuevo sistema de componentes, no usar el legacy
    if (hasConfiguredComponents) return [];
    if (!isComposite || !productId || productId === CUSTOM_PRODUCT_ID) return [];
    return getAvailableConfigs(enabledComponents);
  }, [isComposite, enabledComponents, productId, hasConfiguredComponents]);
  
  const needsConfigSelector = availableConfigs.length > 0;
  
  // Producto compuesto está listo para mostrar datos cuando:
  // - Tiene componentes configurados Y al menos un obligatorio (automático)
  // - O tiene el sistema legacy Y se seleccionó una configuración
  const isCompositeReady = hasConfiguredComponents 
    ? (hasRequiredComponentsConfigured || activeCompositeComponents.length > 0)
    : (!needsConfigSelector || boundProductConfig !== null);

  // Al cambiar de producto: resetear UI de compuestos
  useEffect(() => {
    if (!productId) return;
    setActiveComponent(""); // Reset - se auto-selecciona cuando llegan datos
    setActiveCompositeComponents([]);
    setCompositeComponentsData({});
    setCompositeTotalPrice(0);
    setCompositeParentOutputs([]);
    setComponentPromptValues({});
  }, [productId]);
  
  // Auto-seleccionar el primer componente cuando lleguen los datos
  useEffect(() => {
    if (!hasConfiguredComponents) return;
    const keys = Object.keys(compositeComponentsData);
    if (keys.length > 0 && (!activeComponent || !compositeComponentsData[activeComponent])) {
      setActiveComponent(keys[0]);
    }
  }, [hasConfiguredComponents, compositeComponentsData, activeComponent]);
  
  // Mantener SIEMPRE activos los componentes obligatorios
  useEffect(() => {
    if (!hasConfiguredComponents) return;

    const requiredInitial = getInitialActiveComponents(configuredComponents);
    const sortByOrder = (arr: ActiveComponent[]) =>
      [...arr].sort((a, b) => a.display_order - b.display_order);

    setActiveCompositeComponents((prev) => {
      if (prev.length === 0) return sortByOrder(requiredInitial);

      const prevIds = new Set(prev.map((c) => c.id));
      const missingRequired = requiredInitial.filter((c) => !prevIds.has(c.id));

      if (missingRequired.length === 0) return prev;

      return sortByOrder([...prev, ...missingRequired]);
    });
  }, [hasConfiguredComponents, configuredComponents]);

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
      setDisplayName(initialData.displayName || "");
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
          setLocalQtyInputs(m.qtyInputs); // Sincronizar estado local
          setQtyCount(Math.max(1, Math.min(MAX_QTY, m.qtyInputs.length)));
        }
      }
      // Activar recálculo automático si es una duplicación
      if (initialData.needsRecalculation) {
        setForceRecalculate(true);
      }
      // Restaurar precio modificado si existe
      if (initialData.modifiedPrice !== null && initialData.modifiedPrice !== undefined) {
        console.log('💰 Restaurando precio modificado:', initialData.modifiedPrice);
        setUserEditedPrice(initialData.modifiedPrice);
      }
      // Restaurar configuración de producto encuadernado si existe
      if (initialData.boundProductConfig) {
        console.log('📦 Restaurando boundProductConfig:', initialData.boundProductConfig);
        setBoundProductConfig(initialData.boundProductConfig);
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

  // Ref para el timer de debounce (ya no usado para campos individuales, solo para compatibilidad)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ya NO usamos debounce automático en promptValues.
  // El recálculo ahora se dispara explícitamente desde handlePromptCommit (onBlur/Enter).

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

  const getProductId = (p: any) =>
    String(p?.id ?? p?.productId ?? p?.product_id ?? p?.easyquote_product_id ?? "");

  // Obtener productos que son componentes (para excluirlos de la selección)
  // IMPORTANTE: esto debe filtrarse por api_user_id (config compartida entre organizaciones del mismo grupo)
  const { data: componentProductIds, isLoading: isLoadingComponents } = useQuery({
    queryKey: ["component-product-ids", effectiveApiUserId],
    queryFn: async () => {
      if (!effectiveApiUserId) {
        console.log("⚠️ No effectiveApiUserId, cannot filter components");
        return [];
      }
      console.log("🔍 Fetching component IDs for apiUserId:", effectiveApiUserId);
      const { data, error } = await supabase
        .from("product_component_settings")
        .select("easyquote_product_id")
        .eq("api_user_id", effectiveApiUserId)
        .eq("is_component", true);

      if (error) {
        console.error("Error fetching component products:", error);
        return [];
      }

      const ids = (data || []).map((d) => d.easyquote_product_id);
      console.log("✅ Component IDs to exclude:", ids);
      return ids;
    },
    enabled: !!effectiveApiUserId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProducts } = useQuery({
    queryKey: ["easyquote-products"],
    queryFn: fetchProducts,
    retry: 1,
    enabled: !!hasToken,
  });

  // Filtrar componentes de la lista de productos para selección
  // Si aún no tenemos api_user_id resuelto, NO mostrar la lista sin filtrar (evita mezclar componentes)
  const products = useMemo(() => {
    if (!allProducts) return [];
    if (isApiUserIdPending) return [];
    if (effectiveApiUserId && isLoadingComponents) return [];

    const componentIds = Array.isArray(componentProductIds) ? componentProductIds : [];
    return allProducts.filter((p: any) => !componentIds.includes(getProductId(p)));
  }, [allProducts, componentProductIds, effectiveApiUserId, isLoadingComponents, isApiUserIdPending]);

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

  // Query para obtener el orden guardado de outputs
  const { data: savedOutputOrder } = useQuery({
    queryKey: ["product-output-order", productId, organizationId],
    queryFn: async () => {
      if (!productId || !organizationId || productId === CUSTOM_PRODUCT_ID) return null;
      const { data, error } = await supabase
        .from("product_output_order")
        .select("output_order")
        .eq("easyquote_product_id", productId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) {
        console.error("Error fetching output order:", error);
        return null;
      }
      return data?.output_order || null;
    },
    enabled: !!productId && !!organizationId && productId !== CUSTOM_PRODUCT_ID,
    staleTime: 5 * 60 * 1000,
  });

  // Los prompts siempre vienen de easyquote-pricing (ya no usamos master-files)

  // Multi-quantity: validación compartida (Q1..Qn)
  const allQtysComplete = useMemo(() => {
    if (!multiEnabled || qtyCount <= 0) return false;
    for (let i = 0; i < qtyCount; i++) {
      const val = qtyInputs[i];
      if (!val || String(val).trim() === "") return false;
      const num = Number(String(val).replace(/\./g, "").replace(",", "."));
      if (Number.isNaN(num) || num <= 0) return false;
    }
    return true;
  }, [multiEnabled, qtyCount, qtyInputs]);

  // Query principal de pricing
  // NOTA: forceRecalculate NO está en queryKey - se usa refetch() manual
  const pricingQueryKey = useMemo(() => {
    // Evitar llamadas duplicadas al seleccionar producto:
    // - Mientras es producto nuevo (GET inicial) o mientras el usuario NO ha confirmado cambios,
    //   mantenemos la key estable por productId.
    // - Solo añadimos los inputs a la key cuando el usuario confirma cambios (onBlur/Enter)
    //   para disparar PATCH.

    if (!productId) return ["easyquote-pricing", "__no_product__"] as const;

    // Para artículos guardados: los inputs forman parte natural de la key desde el principio.
    if (initialData) return ["easyquote-pricing", productId, debouncedPromptValues, "saved"] as const;

    const hasInputs = !!debouncedPromptValues && Object.keys(debouncedPromptValues).length > 0;
    const includeInputsInKey = !isNewProduct && hasInputs && userHasChangedCurrentProduct;

    return includeInputsInKey
      ? (["easyquote-pricing", productId, debouncedPromptValues] as const)
      : (["easyquote-pricing", productId] as const);
  }, [productId, debouncedPromptValues, isNewProduct, userHasChangedCurrentProduct, initialData]);

  const { data: pricing, error: pricingError, refetch: refetchPricing, isError: isPricingError, isFetching: isPricingLoading } = useQuery({
    queryKey: pricingQueryKey,
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

      // Si multi-cantidades está activo y completo, el pricing principal viene de easyquote-multi (Q1)
      // para evitar llamadas duplicadas.
      if (multiEnabled && qtyPrompt && allQtysComplete) {
        console.log("⏸️ Query disabled: multi-cantidades activo (pricing viene de Q1)");
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
        if (!userHasChangedCurrentProduct) {
          console.log("ℹ️ Query disabled: usando datos guardados, sin cambios del usuario");
          return false;
        }
        console.log("✅ Query enabled: usuario ha modificado el producto guardado");
        return true;
      }
      
      // Para productos NO guardados, evitamos un PATCH automático tras el GET inicial.
      // Solo recalculamos cuando el usuario confirma algún cambio (onBlur/Enter).
      if (!initialData && !userHasChangedCurrentProduct) {
        console.log("ℹ️ Query disabled: producto sin cambios del usuario");
        return false;
      }

      // Query normal para productos con prompts
      console.log("✅ Query enabled: producto con prompts");
      return true;
    })(),
    retry: 2, // Reintentar 2 veces en errores transitorios
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Backoff: 1s, 2s, max 5s
    placeholderData: isNewProduct ? undefined : keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 segundos - evita re-fetches inmediatos
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      
      console.log("🔥 Fetching pricing for product:", productId);
      console.log("  - isNewProduct:", isNewProduct);
      console.log("  - userHasChangedCurrentProduct:", userHasChangedCurrentProduct);
      console.log("  - debouncedPromptValues:", debouncedPromptValues);

      // Helper para detectar si un ID es un GUID válido
      const isValidGuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      // Determinar el tipo de producto para métricas
      const productTypeForMetrics = hasConfiguredComponents 
        ? "composite" 
        : isComposite 
          ? "bound" 
          : "simple";
      
      const requestBody: any = {
        token,
        productId,
        productType: productTypeForMetrics,
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
      
      // Para productos de API: reconciliar prompts con la respuesta actual del API.
      // Objetivos:
      // 1) Evitar acumulación de prompts que ya no existen tras un PATCH (dependencias/condicionales)
      // 2) Evitar guardar solo el último prompt cambiado: siempre mantener el conjunto completo actual
      // 3) Mantener valores del usuario cuando siguen siendo válidos
       if (!isNewProduct && data?.prompts && !isCustomProduct) {
        const apiPrompts: any[] = Array.isArray(data.prompts) ? data.prompts : [];

        console.log("🔄 Reconciliando prompts con API (sin acumular):", {
          productId,
          apiPromptsCount: apiPrompts.length,
          currentPromptsCount: Object.keys(promptValues).length,
           mode: "api_is_source_of_truth",
        });

         setPromptValues((prev) => {
          const norm = (v: any) => String(v ?? "").trim().toLowerCase();
          const next: Record<string, any> = {};

          for (const p of apiPrompts) {
            if (!p?.id) continue;
            const pid = String(p.id);

            const prevEntry = (prev as any)[pid];
            const prevValue =
              prevEntry && typeof prevEntry === "object" && prevEntry !== null && "value" in prevEntry
                ? prevEntry.value
                : prevEntry;

            const apiValue = p.currentValue;
            const options = Array.isArray(p.valueOptions) ? p.valueOptions : [];

            const hasPrevValue = prevValue !== undefined && prevValue !== null && String(prevValue).trim() !== "";
            const prevValueIsValid = options.length === 0 ? true : options.some((o: any) => norm(o) === norm(prevValue));

            // Mantener el valor previo si existe y sigue siendo válido; si no, usar el currentValue del API.
            const value = hasPrevValue && prevValueIsValid ? prevValue : apiValue;

            next[pid] = {
              label: p.promptText || p.label || prevEntry?.label || pid,
              value,
              order: p.promptSequence ?? p.order ?? prevEntry?.order ?? 999,
            };
          }

           // REGLA: el último resultado del pricing (GET/PATCH) es la fuente de verdad.
           // Si un prompt deja de venir en la respuesta, se elimina del estado y NO se
           // vuelve a enviar en el siguiente PATCH (evita acumulación).
           setDebouncedPromptValues(next);
           return next;
        });

        setIsInitializing(false);
      } else if (!isNewProduct && data?.prompts) {
        // Para productos custom, no tocar prompts
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
      
      // CACHE DE OPCIONES: Guardar las valueOptions de cada prompt la primera vez
      if (data?.prompts && Array.isArray(data.prompts)) {
        const cacheKey = productId;
        const isFirstLoad = !promptOptionsCache.current[cacheKey];
        
        if (isFirstLoad) {
          // Primera carga: guardar todas las opciones en cache
          console.log("📦 Cacheando opciones de prompts para producto:", productId);
          promptOptionsCache.current[cacheKey] = data.prompts.map((p: any) => ({
            id: p.id,
            valueOptions: p.valueOptions || []
          }));
        } else {
          // Cargas posteriores: el API puede devolver opciones actualizadas para prompts dependientes.
          // SOLO usar cache cuando el API no devuelve opciones (vacías o undefined).
          // Si el API devuelve opciones, usarlas (pueden haber cambiado dinámicamente).
          const cachedOptions = promptOptionsCache.current[cacheKey];
          if (cachedOptions && cachedOptions.length > 0) {
            data.prompts.forEach((prompt: any) => {
              const cached = cachedOptions.find((c: any) => c.id === prompt.id);
              const apiHasOptions = prompt.valueOptions && prompt.valueOptions.length > 0;
              
              if (!apiHasOptions && cached && cached.valueOptions?.length > 0) {
                // API no devolvió opciones -> restaurar del cache
                prompt.valueOptions = cached.valueOptions;
              } else if (apiHasOptions && cached) {
                // API devolvió opciones nuevas -> actualizar cache con las nuevas opciones
                cached.valueOptions = prompt.valueOptions;
              }
            });
          }
        }
      }
      
      return data;
    },
  });

  // Forzar recálculo cuando se activa el flag
  useEffect(() => {
    if (forceRecalculate && hasToken && productId) {
      if (multiEnabled && qtyPrompt && allQtysComplete) {
        queryClient.invalidateQueries({ queryKey: ["easyquote-multi", productId] });
      } else {
        refetchPricing();
      }
      setForceRecalculate(false);
      setUserEditedPrice(null); // Reset precio editado al recalcular
    }
  }, [forceRecalculate, hasToken, productId, refetchPricing, multiEnabled, qtyPrompt, allQtysComplete, queryClient]);

  // Inicializar prompts con valores por defecto del producto (SOLO para productos nuevos sin datos)
  // NOTA: NO incluir promptValues en dependencias para evitar re-ejecución en cada keystroke
  const promptValuesLengthRef = useRef(0);
  useEffect(() => {
    promptValuesLengthRef.current = Object.keys(promptValues).length;
  }, [promptValues]);
  
  useEffect(() => {
    if (!pricing?.prompts || !Array.isArray(pricing.prompts)) return;
    
    // Si NO hay initialData, inicializar con valores por defecto (producto nuevo)
    // Usar ref para evitar dependencia directa de promptValues
    if (!initialData && isNewProduct && promptValuesLengthRef.current === 0) {
      console.log("🎨 Producto NUEVO - Inicializando promptValues con valores por defecto de pricing");
      const defaultValues: Record<string, any> = {};
      pricing.prompts.forEach((prompt: any) => {
        if (prompt.id && prompt.currentValue !== undefined && prompt.currentValue !== null) {
          defaultValues[prompt.id] = {
            label: prompt.promptText || prompt.label || prompt.id,
            value: prompt.currentValue,
            order: prompt.promptSequence ?? prompt.order ?? 999
          };
        }
      });
      
      if (Object.keys(defaultValues).length > 0) {
        console.log("✅ Estableciendo valores iniciales:", defaultValues);
        setPromptValues(defaultValues);
        setDebouncedPromptValues(defaultValues);
      }
    }
    // NO incluir promptValues como dependencia - solo necesitamos esto cuando pricing cambia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing, isNewProduct, initialData, hasPerformedInitialLoad]);

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
      setLocalQtyInputs(["", "", "", "", ""]); // Reset estado local también
      setItemAdditionals([]);
      setItemDescription("");
      setIsNewProduct(true);
      setHasInitialOutputs(false);
      setForceRecalculate(false);
      setHasUnsavedChanges(false);
      setUserHasChangedCurrentProduct(false); // Reset flag para nuevo producto
      setHasPerformedInitialLoad(false); // Reset flag para carga inicial
      setBoundProductConfig(null); // Reset configuración de producto encuadernado
      setUserEditedPrice(null); // Reset precio editado por usuario
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

  // Aplicar orden guardado a los outputs
  const sortedOutputs = useMemo(() => {
    if (!savedOutputOrder || savedOutputOrder.length === 0) return outputs;

    // Si los outputs no traen nameCell todavía (pricing), NO forzar sort aquí.
    // El orden real se aplicará en ComponentTabsOutputs tras resolver nameCell vía definiciones.
    const hasAnyCell = outputs.some((o: any) => !!(o?.nameCell || o?.outputNameCell || o?.name_cell));
    if (!hasAnyCell) return outputs;

    const normalizeKey = (v: any) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

    // savedOutputOrder contiene nameCells (los rótulos/celdas de los outputs)
    const orderMap = new Map(savedOutputOrder.map((k: string, idx: number) => [normalizeKey(k), idx]));

    return [...outputs].sort((a: any, b: any) => {
      const aKey = normalizeKey(a?.nameCell || a?.outputNameCell || a?.name_cell || "");
      const bKey = normalizeKey(b?.nameCell || b?.outputNameCell || b?.name_cell || "");
      const aIdx = aKey && orderMap.has(aKey) ? orderMap.get(aKey)! : 999;
      const bIdx = bKey && orderMap.has(bKey) ? orderMap.get(bKey)! : 999;
      return aIdx - bIdx;
    });
  }, [outputs, savedOutputOrder]);

  const imageOutputs = useMemo(
    () => sortedOutputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? ""))),
    [sortedOutputs]
  );

  // EasyQuote devuelve varios outputs de precio (parciales y/o total).
  // Para evitar discrepancias (p.ej. Q1 en multi vs precio principal), escogemos el TOTAL si existe.
  // Fallback: el mayor valor numérico entre los outputs de precio.
  // EasyQuote devuelve varios outputs de precio (parciales y/o total).
  // Para evitar discrepancias, SIEMPRE priorizamos outputs con type="Price".
  // Solo si no existe ninguno, hacemos fallback a nombres que contengan "precio/price".
  const priceOutput = useMemo(() => {
    const isStrictPriceType = (o: any) => String(o?.type || "").toLowerCase() === "price";
    const isNamePriceLike = (o: any) => {
      const name = String(o?.name || "").toLowerCase();
      return name.includes("precio") || name.includes("price");
    };

    const parseEsNumberInline = (val: any): number => {
      if (typeof val === "number") return val;
      const n = parseFloat(String(val ?? "").replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : NaN;
    };

    // 1) Preferir type=Price
    let prices = sortedOutputs.filter(isStrictPriceType);

    // 2) Fallback: outputs con nombre tipo precio
    if (prices.length === 0) prices = sortedOutputs.filter(isNamePriceLike);

    if (prices.length === 0) return undefined;

    const totalLike = prices.find((o: any) => /total/i.test(String(o?.name ?? "")));
    if (totalLike) return totalLike;

    const nums = prices
      .map((o: any) => parseEsNumberInline(o?.value))
      .filter((n: number) => Number.isFinite(n));

    if (nums.length === 0) return prices[0];

    const max = Math.max(...nums);
    return prices.find((o: any) => parseEsNumberInline(o?.value) === max) ?? prices[0];
  }, [sortedOutputs]);
  const otherOutputs = useMemo(
    () =>
      sortedOutputs.filter((o: any) => {
        const t = String(o?.type || "").toLowerCase();
        const n = String(o?.name || "").toLowerCase();
        const v = String(o?.value ?? "");
        const isImageLike = t.includes("image") || n.includes("image");
        const isNA = v === "" || v === "#N/A";
        return o !== priceOutput && !isImageLike && !isNA;
      }),
    [sortedOutputs, priceOutput]
  );

  // Multi-quantity query:
  // - Se dispara SOLO cuando todas las cantidades están completas
  // - No espera a que termine el pricing principal (para que Q2..Qn puedan empezar en paralelo)
  // (allQtysComplete se calcula más arriba para poder controlar también la query principal)

  // Multi-quantity query for SIMPLE products (no components)
  const { data: multiResults, isFetching: multiLoading } = useQuery({
    queryKey: [
      "easyquote-multi",
      productId,
      debouncedPromptValues,
      qtyPrompt,
      qtyInputs,
      multiEnabled,
      allQtysComplete,
    ],
    // No esperar a isPricingLoading - Q2/Q3 se lanzan en paralelo con Q1
    // Solo ejecutar para productos simples (sin componentes configurados)
    enabled: !!hasToken && !!productId && multiEnabled && !!qtyPrompt && allQtysComplete && !hasConfiguredComponents,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 30000,
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");

      const norm: Record<string, any> = {};
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        const actualValue = (v && typeof v === "object" && "value" in v) ? (v as any).value : v;

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
        .filter((n) => !Number.isNaN(n) && n > 0);
      if (qtys.length === 0) return [] as any[];

      const list = Object.entries(norm).map(([id, value]) => ({ id, value }));

      // Cuando multi está activo, calculamos TODAS las cantidades (Q1..Qn) en paralelo aquí.
      // Así evitamos el patrón "primero cantidad principal y luego Q1/Q2/Q3".
      const qtysToFetch = qtys;

      console.log("🔢 Multi-cantidad (simple): lanzando", qtysToFetch.length, "llamadas en paralelo", {
        qtysToFetch,
      });

      const q1Qty = qtysToFetch[0];

      const fetched = await Promise.all(
        qtysToFetch.map(async (qty) => {
          const replaced = list
            .filter((it) => String(it.id) !== String(qtyPrompt))
            .concat([{ id: qtyPrompt, value: qty }]);

          const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
            token,
            productId,
            inputs: replaced,
          });
          if (error) throw error;

          // Optimización: para Q2..Qn solo necesitamos outputValues (reduce memoria y render lento)
          const slimData = qty === q1Qty ? data : { outputValues: (data as any)?.outputValues };
          return { qty, data: slimData };
        })
      );

      const fetchedByQty = new Map<number, any>(fetched.map((r) => [r.qty, r.data]));

      // Reconstruir respetando el orden de qtyInputs
      const results: { qty: number; data: any }[] = qtys.map((qty) => ({
        qty,
        data: fetchedByQty.get(qty),
      }));

      return results;
    },
  });

  // Multi-quantity query for COMPOSITE products (with configured components)
  // For each quantity, we calculate all components and sum their prices
  const { data: compositeMultiResults, isFetching: compositeMultiLoading } = useQuery({
    queryKey: [
      "composite-multi",
      productId,
      debouncedPromptValues,
      qtyPrompt,
      qtyInputs,
      multiEnabled,
      allQtysComplete,
      activeCompositeComponents.map(c => `${c.id}:${c.instance_index}`).join(","),
      JSON.stringify(componentPromptValues),
      organizationId,
    ],
    enabled: !!hasToken && !!productId && multiEnabled && !!qtyPrompt && allQtysComplete && hasConfiguredComponents && activeCompositeComponents.length > 0,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 30000,
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");

      const qtys = qtyInputs
        .map((q) => Number(String(q).replace(/\./g, "").replace(",", ".")))
        .filter((n) => !Number.isNaN(n) && n > 0);
      if (qtys.length === 0) return [] as any[];

      console.log("🔢 Multi-cantidad (compuesto): lanzando cálculos para", qtys.length, "cantidades con", activeCompositeComponents.length, "componentes");

      // Fetch prompt connections for this composite product
      const { data: promptConnections } = await supabase
        .from("composite_prompt_connections")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("composite_product_id", productId);

      // For each quantity, calculate all components in parallel
      const results = await Promise.all(
        qtys.map(async (qty) => {
          // Calculate price for each component with this quantity
          const componentPrices = await Promise.all(
            activeCompositeComponents.map(async (component) => {
              // Build inputs for this component
              const componentInputs: { id: string; value: any }[] = [];
              
              // Get connections for this component
              const connections = (promptConnections || []).filter(
                (conn: any) => 
                  conn.target_component_id === component.id || 
                  conn.target_component_id === component.component_product_id
              );

              // Add inherited values from parent prompts (with quantity replaced)
              for (const conn of connections as any[]) {
                let sourceValue: any;
                
                // If this is the quantity prompt connection, use the current qty
                if (conn.source_prompt_name === qtyPrompt) {
                  sourceValue = qty;
                } else {
                  // Get value from parent prompt values
                  sourceValue = debouncedPromptValues[conn.source_prompt_name];
                  if (sourceValue && typeof sourceValue === 'object' && 'value' in sourceValue) {
                    sourceValue = sourceValue.value;
                  }
                }
                
                if (sourceValue !== undefined && sourceValue !== null) {
                  componentInputs.push({
                    id: conn.target_prompt_name,
                    value: sourceValue,
                  });
                }
              }
              
              // Add user-edited component values (if any)
              const componentKey = `${component.id}:${component.instance_index || 1}`;
              const userEditedValues = componentPromptValues[componentKey] || {};
              for (const [promptId, value] of Object.entries(userEditedValues)) {
                if (value !== undefined && value !== null) {
                  const existingIdx = componentInputs.findIndex(i => i.id === promptId);
                  if (existingIdx >= 0) {
                    componentInputs[existingIdx].value = value;
                  } else {
                    componentInputs.push({ id: promptId, value });
                  }
                }
              }

              try {
                const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
                  token,
                  productId: component.component_product_id,
                  inputs: componentInputs,
                });
                
                if (error) {
                  console.error(`Error calculating component ${component.component_alias}:`, error);
                  return 0;
                }
                
                // Extract price from outputs
                const outputs = data?.outputValues || data?.outputs || [];
                const priceOutput = outputs.find(
                  (o: any) => String(o?.type || "").toLowerCase() === "price"
                );
                const price = priceOutput
                  ? parseFloat(String(priceOutput.value ?? "0").replace(/\./g, "").replace(",", ".")) || 0
                  : 0;
                  
                return price;
              } catch (err) {
                console.error(`Error calculating component ${component.component_alias}:`, err);
                return 0;
              }
            })
          );

          // Sum all component prices for this quantity
          const totalPrice = componentPrices.reduce((sum, price) => sum + price, 0);
          
          return {
            qty,
            data: {
              outputValues: [
                { type: "Price", name: "Precio", value: totalPrice.toFixed(2).replace(".", ",") }
              ]
            },
            totalPrice,
          };
        })
      );

      console.log("🔢 Multi-cantidad (compuesto) resultados:", results.map(r => ({ qty: r.qty, price: r.totalPrice })));

      return results;
    },
  });

  // Cuando multi está activo, usamos el resultado de Q1 como "pricing" principal
  // para que el resto del componente (prompts/outputs/precio) no dispare otra llamada.
  useEffect(() => {
    if (!multiEnabled || !qtyPrompt || !allQtysComplete) return;
    if (!Array.isArray(multiResults) || multiResults.length === 0) return;
    const q1 = (multiResults[0] as any)?.data;
    if (!q1) return;

    queryClient.setQueryData(pricingQueryKey, q1);
  }, [multiEnabled, qtyPrompt, allQtysComplete, multiResults, queryClient, pricingQueryKey]);

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

  // Sync Q1 with the selected qtyPrompt field value - SOLO cuando hay commit (debouncedPromptValues)
  // IMPORTANTE: Usar debouncedPromptValues para evitar sincronizar en cada keystroke
  useEffect(() => {
    if (!qtyPrompt) return;
    
    // Get current value from debouncedPromptValues (committed values) or from pricing defaults
    let currentRaw = (debouncedPromptValues as any)[qtyPrompt];
    // Extract actual value if it's stored as {label, value}
    let current = (currentRaw && typeof currentRaw === 'object' && 'value' in currentRaw) ? currentRaw.value : currentRaw;
    
    // If not in debouncedPromptValues, try to get it from pricing prompts defaults
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
      // También sincronizar el estado local
      setLocalQtyInputs((prev) => {
        const next = [...prev];
        next[0] = asStr;
        return next;
      });
    }
  }, [qtyPrompt, debouncedPromptValues, pricing]);

  // Adjust qty inputs length - sincronizar ambos estados
  useEffect(() => {
    setQtyInputs((prev) => {
      if (qtyCount > prev.length) return prev.concat(Array(qtyCount - prev.length).fill(""));
      if (qtyCount < prev.length) return prev.slice(0, qtyCount);
      return prev;
    });
    setLocalQtyInputs((prev) => {
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

  const parseEsNumber = (val: any): number => {
    if (typeof val === "number") return val;
    const n = parseFloat(String(val ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const isPriceOutput = (o: any) => {
    // STRICT: priorizar type=Price para evitar coger "Precio (IVA incluido)" por el nombre.
    return String(o?.type || "").toLowerCase() === "price";
  };

  // EasyQuote ya devuelve el precio final calculado. NO sumamos parciales nunca.
  // Si hay varios outputs de precio (Cubierta/Interior/Total), priorizamos "Total".
  // Si no existe, usamos el mayor valor numérico (suele ser el total) como fallback seguro.
  // Si no hay ningún output con type=Price, hacemos fallback a nombres tipo "precio/price".
  const getCalculatedPriceFromOutputs = (outs: any[]): number => {
    const arr = Array.isArray(outs) ? outs : [];
    const strict = arr.filter(isPriceOutput);

    const nameFallback = arr.filter((o: any) => {
      const name = String(o?.name || "").toLowerCase();
      return name.includes("precio") || name.includes("price");
    });

    const prices = strict.length > 0 ? strict : nameFallback;
    if (prices.length === 0) return NaN;

    const totalLike = prices.find((o: any) => /total/i.test(String(o?.name ?? "")));
    if (totalLike) return parseEsNumber(totalLike.value);

    const nums = prices
      .map((o: any) => parseEsNumber(o?.value))
      .filter((n: number) => Number.isFinite(n));

    if (nums.length === 0) return NaN;
    return Math.max(...nums);
  };

  const multiRows = useMemo(() => {
    // First, check if we have saved multi data from initialData
    const hasNewMultiResults = hasConfiguredComponents ? compositeMultiResults : multiResults;
    if (initialData?.multi?.rows && Array.isArray(initialData.multi.rows) && !hasNewMultiResults) {
      // Use saved data
      return initialData.multi.rows.map((r: any) => {
        const outs: any[] = Array.isArray(r?.outs) ? r.outs : [];
        return { 
          qty: r.qty, 
          outs, 
          totalStr: r.totalStr ?? "", 
          unit: r.unit ?? NaN 
        };
      });
    }
    
    // For composite products, use compositeMultiResults
    if (hasConfiguredComponents && compositeMultiResults) {
      return (compositeMultiResults as any[]).map((r: any) => {
        const outs: any[] = Array.isArray(r?.data?.outputValues) ? r.data.outputValues : [];
        const totalNum = r.totalPrice ?? getCalculatedPriceFromOutputs(outs);
        const unit = r.qty > 0 && Number.isFinite(totalNum) ? totalNum / r.qty : NaN;
        return { qty: r.qty, outs, totalStr: totalNum, unit };
      });
    }
    
    // For simple products, use multiResults
    const rows = (multiResults as any[] | undefined) || [];
    return rows.map((r: any) => {
      const outs: any[] = Array.isArray(r?.data?.outputValues) ? r.data.outputValues : [];

      // Para multi-cantidades, NO usar r.data.price (a veces viene con IVA).
      // Usamos el output type=Price (o fallback por nombre si no existe).
      const totalNum = getCalculatedPriceFromOutputs(outs);

      const unit = r.qty > 0 && Number.isFinite(totalNum) ? totalNum / r.qty : NaN;
      return { qty: r.qty, outs, totalStr: totalNum, unit };
    });
  }, [multiResults, compositeMultiResults, hasConfiguredComponents, initialData?.multi?.rows]);

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
          } else if (additional.type === 'capacity_divider') {
            // Calculate how many units are needed based on capacity
            const capacity = additional.capacity_value || 1;
            const unitsNeeded = Math.ceil(customQuantity / capacity);
            additionalsTotal += additional.value * unitsNeeded;
          }
        });
      }
      
      return basePrice + additionalsTotal;
    }
    
    // Para productos COMPUESTOS: usar compositeTotalPrice (suma de componentes)
    if (hasConfiguredComponents && compositeTotalPrice > 0) {
      let additionalsTotal = 0;
      let quantity = 1;
      
      // Obtener cantidad del prompt
      if (qtyPrompt && promptValues[qtyPrompt]) {
        const qtyValue = promptValues[qtyPrompt];
        const rawQty = (qtyValue && typeof qtyValue === 'object' && 'value' in qtyValue) 
          ? qtyValue.value 
          : qtyValue;
        const parsedQty = parseFloat(String(rawQty).replace(/\./g, "").replace(",", "."));
        if (!isNaN(parsedQty) && parsedQty > 0) {
          quantity = parsedQty;
        }
      }
      
      if (Array.isArray(itemAdditionals)) {
        itemAdditionals.forEach((additional) => {
          if (additional.type === 'net_amount') {
            additionalsTotal += additional.value;
          } else if (additional.type === 'quantity_multiplier') {
            additionalsTotal += additional.value * quantity;
          } else if (additional.type === 'capacity_divider') {
            const capacity = additional.capacity_value || 1;
            const unitsNeeded = Math.ceil(quantity / capacity);
            additionalsTotal += additional.value * unitsNeeded;
          }
        });
      }
      
      return compositeTotalPrice + additionalsTotal;
    }
    
    // Para productos API simples: el precio que queremos mostrar/guardar es el output con type=Price.
    // pricing.price a veces viene con IVA, así que solo lo usamos como fallback.
    const outputPrice = (priceOutput as any)?.value;
    const pricingPrice = (pricing as any)?.price;

    let basePrice: number;
    
    // Si multi-cantidades está activo, usar el precio de Q1 como referencia para el total
    if (multiEnabled && multiRows.length > 0) {
      const q1Price = multiRows[0]?.totalStr ?? multiRows[0]?.price ?? 0;
      basePrice = parseFloat(String(q1Price).replace(/\./g, "").replace(",", ".")) || 0;
    } else if (outputPrice !== undefined && outputPrice !== null) {
      basePrice = parseFloat(String(outputPrice).replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      basePrice = parseFloat(String(pricingPrice ?? 0).replace(/\./g, "").replace(",", ".")) || 0;
    }
    let additionalsTotal = 0;
    
    // Get quantity from Q1 only (first row or prompt value) - alternatives are independent
    let quantity = 1;
    if (multiEnabled && multiRows.length > 0) {
      // Use only Q1 (first row) for additionals calculation
      quantity = multiRows[0]?.qty || 1;
    } else if (qtyPrompt && promptValues[qtyPrompt]) {
      const qtyValue = promptValues[qtyPrompt];
      const rawQty = (qtyValue && typeof qtyValue === 'object' && 'value' in qtyValue) 
        ? qtyValue.value 
        : qtyValue;
      const parsedQty = parseFloat(String(rawQty).replace(/\./g, "").replace(",", "."));
      if (!isNaN(parsedQty) && parsedQty > 0) {
        quantity = parsedQty;
      }
    }
    
    if (Array.isArray(itemAdditionals)) {
      itemAdditionals.forEach((additional) => {
        if (additional.type === 'net_amount') {
          additionalsTotal += additional.value;
        } else if (additional.type === 'quantity_multiplier') {
          additionalsTotal += additional.value * quantity;
        } else if (additional.type === 'capacity_divider') {
          // Use Q1 only for capacity calculation
          const capacity = additional.capacity_value || 1;
          const unitsNeeded = Math.ceil(quantity / capacity);
          additionalsTotal += additional.value * unitsNeeded;
        }
      });
    }
    
    return basePrice + additionalsTotal;
  }, [priceOutput, itemAdditionals, multiEnabled, multiRows, isCustomProduct, customPrice, customQuantity, qtyPrompt, promptValues, hasConfiguredComponents, compositeTotalPrice, pricing]);

  // Calculate additionals breakdown for a specific quantity
  const calculateAdditionalsForQty = useMemo(() => {
    return (qty: number) => {
      if (!Array.isArray(itemAdditionals) || itemAdditionals.length === 0) {
        return { total: 0, breakdown: [] };
      }
      
      const breakdown: { name: string; value: number; type: string }[] = [];
      let total = 0;
      
      itemAdditionals.forEach((additional) => {
        let additionalValue = 0;
        if (additional.type === 'net_amount') {
          additionalValue = additional.value;
        } else if (additional.type === 'quantity_multiplier') {
          additionalValue = additional.value * qty;
        } else if (additional.type === 'capacity_divider') {
          const capacity = additional.capacity_value || 1;
          const unitsNeeded = Math.ceil(qty / capacity);
          additionalValue = additional.value * unitsNeeded;
        }
        
        if (additionalValue !== 0) {
          breakdown.push({
            name: additional.name,
            value: additionalValue,
            type: additional.type
          });
          total += additionalValue;
        }
      });
      
      return { total, breakdown };
    };
  }, [itemAdditionals]);

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

  // Handler para cambios mientras se escribe - NO dispara API, solo actualiza estado local
  // IMPORTANTE: NO llamar a setUserHasChangedCurrentProduct aquí para evitar re-renders innecesarios
  const handlePromptChange = (id: string, value: any, label: string) => {
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

  // Handler para commit (onBlur o Enter) - dispara el recálculo de precios
  const handlePromptCommit = useCallback((id: string, value: any, label: string) => {
    console.log("✅ Prompt committed (blur/enter):", { id, value, label });
    
    // Marcar que el usuario ha cambiado valores (solo en commit, no en cada keystroke)
    setUserHasChangedCurrentProduct(true);
    
    // Actualizar el estado de prompts con el valor final
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
      
      const newValues = {
        ...prev, 
        [id]: { 
          label, 
          value,
          order: order !== undefined ? order : 999
        } 
      };
      
      // Disparar inmediatamente el recálculo actualizando debouncedPromptValues
      setDebouncedPromptValues(newValues);
      
      return newValues;
    });
  }, [pricing]);

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
    
    // Para productos de API, si aún no tenemos promptValues (por ejemplo,
    // justo tras seleccionar el producto), intentamos derivarlos del pricing
    // para poder sincronizar precio/outputs al padre y que el subtotal se actualice.
    const hasPromptValues = Object.keys(promptValues).length > 0;
    const pricingPrompts = Array.isArray((pricing as any)?.prompts) ? ((pricing as any).prompts as any[]) : [];

    console.log('🔄 syncToParent ejecutándose:', {
      productId,
      isCustomProduct,
      hasPromptValues,
      pricingPromptsCount: pricingPrompts.length,
      promptValuesKeys: Object.keys(promptValues),
      promptValuesCount: Object.keys(promptValues).length,
      promptValues,
      hasOutputs: outputs && outputs.length > 0,
    });

    // IMPORTANTE: En el estado de la app, `prompts` debe ser SIEMPRE un objeto
    // { [promptId]: { label, value, order } }.
    // El formato array [{id,label,value,order}] se usa SOLO al persistir en DB.
    // Si aquí enviamos un array, las pantallas de guardado (QuoteNew/QuoteEdit)
    // pueden terminar guardando índices "0", "1"... como IDs, mezclando prompts.
    let promptsObj: Record<string, { label: string; value: any; order: number }> = {};

    // For custom products, create synthetic prompts for quantity and price
    if (isCustomProduct) {
      promptsObj = {
        custom_quantity: { label: "Cantidad", value: customQuantity, order: 1 },
        custom_unit_price: { label: "Precio unitario", value: customPrice, order: 2 },
      };
    } else if (hasPromptValues) {
      // Guardar TODOS los prompts basándonos en promptValues (fuente de verdad)
      const next: typeof promptsObj = {};
      Object.entries(promptValues).forEach(([promptId, promptData]) => {
        if (typeof promptData === "object" && promptData !== null && "value" in promptData) {
          next[promptId] = {
            label: (promptData as any).label || promptId,
            value: (promptData as any).value,
            order: (promptData as any).order ?? 999,
          };
        } else {
          next[promptId] = {
            label: promptId,
            value: promptData,
            order: 999,
          };
        }
      });
      promptsObj = next;
    } else if (pricingPrompts.length > 0) {
      // Fallback: aún no se han inicializado promptValues pero sí tenemos
      // definiciones/valores desde EasyQuote (GET inicial). Los usamos para
      // sincronizar y actualizar el subtotal.
      const next: typeof promptsObj = {};
      pricingPrompts
        .filter((p: any) => !!p?.id)
        .forEach((p: any) => {
          next[p.id] = {
            label: p.promptText || p.label || p.id,
            value: p.currentValue,
            order: p.promptSequence ?? p.order ?? 999,
          };
        });
      promptsObj = next;
    }

    // Si seguimos sin prompts, no bloqueamos: permitimos sincronizar outputs/precio.

    // Obtener nombre original del producto API
    const originalProductName = products?.find((p: any) => String(p.id) === String(productId)) 
      ? getProductLabel(products.find((p: any) => String(p.id) === String(productId))) 
      : "";
    
    const snapshot = {
      productId,
      prompts: promptsObj,
      outputs: isCustomProduct ? [] : outputs,
      price: userEditedPrice !== null ? userEditedPrice : finalPrice, // Usar precio modificado si existe
      modifiedPrice: userEditedPrice, // Guardar precio modificado por separado
      multi: multiEnabled ? { qtyPrompt, qtyInputs, rows: multiRows } : null,
      displayName: displayName || originalProductName, // Nombre a mostrar (editable)
      productName: originalProductName, // Nombre original del producto API
      itemDescription: isCustomProduct ? (itemDescription || "Artículo personalizado") : "", // Solo para productos custom
      itemAdditionals,
      // Preservar isFinalized del padre (initialData) - NO sobrescribirlo aquí
      boundProductConfig, // Guardar configuración de producto encuadernado
    };
    
    const snapshotString = JSON.stringify(snapshot);
    if (snapshotString !== lastSyncedSnapshot.current) {
      lastSyncedSnapshot.current = snapshotString;
      console.log('✅ Sincronizando snapshot al padre:', {
        promptsCount: Object.keys(promptsObj).length,
        snapshotPreview: {
          ...snapshot,
          prompts: Object.entries(promptsObj)
            .slice(0, 3)
            .map(([pid, p]) => ({ id: pid, ...p })),
        },
      });
      onChange(id, snapshot);
    } else {
      console.log('⏭️ Snapshot sin cambios, no sincronizando');
    }
  }, [id, onChange, productId, promptValues, outputs, finalPrice, multiEnabled, qtyPrompt, qtyInputs, multiRows, displayName, itemDescription, itemAdditionals, products, initialData?.isFinalized, isInitializing, isCustomProduct, customPrice, customQuantity, pricing, isPricingLoading, userEditedPrice, boundProductConfig]);

  // Verificar que el artículo está completo Y no se está recalculando el precio
  const isCalculating = isPricingLoading || multiLoading || compositeMultiLoading;
  const isComplete = productId && !isCalculating && ((isCustomProduct && customPrice > 0 && itemDescription) || (priceOutput && finalPrice > 0));

  // Sincronizar automáticamente cuando cambien los prompts/cálculo (excepto durante inicialización o cálculo)
  useEffect(() => {
    if (!isInitializing && !isPricingLoading && productId) {
      // Para productos personalizados, sincronizar cuando cambien los campos
      if (isCustomProduct && itemDescription) {
        console.log('🔄 Auto-sincronizando cambios de producto personalizado');
        syncToParent();
      }
      // Para productos de API, sincronizar también en la carga inicial (aunque promptValues esté vacío)
      else if (!isCustomProduct) {
        console.log('🔄 Auto-sincronizando producto de API (prompts/pricing)');
        syncToParent();
      }
    }
  }, [
    productId,
    isCustomProduct,
    itemDescription,
    promptValues,
    customPrice,
    customQuantity,
    userEditedPrice,
    boundProductConfig,
    pricing,
    isInitializing,
    isPricingLoading,
    syncToParent,
  ]);

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
            {displayName || itemDescription || "Sin nombre"}
            {multiEnabled && <span className="text-sm text-muted-foreground/70 ml-2">(cantidad múltiple activada)</span>}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold">{formatEUR(userEditedPrice !== null ? userEditedPrice : finalPrice)}</span>
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
          
          <div className={`grid gap-4 mb-4 ${needsConfigSelector && boundProductConfig ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
            <div className="space-y-2">
              <Label>Selecciona producto</Label>
              <Select onValueChange={(value) => {
                console.log("🔄 Usuario cambió de producto:", value);
                console.log("🔍 Products disponibles:", products);
                setProductId(value);
                if (value === CUSTOM_PRODUCT_ID) {
                  setItemDescription("Artículo personalizado");
                  setDisplayName("Artículo personalizado");
                  setCustomPrice(0);
                  setCustomQuantity(1);
                } else {
                  // Producto de la API: usar el nombre del producto como displayName
                  const selectedProduct = products?.find((p: any) => String(getProductId(p)) === String(value));
                  console.log("🔍 Producto encontrado:", selectedProduct);
                  if (selectedProduct) {
                    const productName = getProductLabel(selectedProduct);
                    console.log("✅ Seteando displayName a:", productName);
                    setDisplayName(productName);
                  }
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
                  {hasToken && products?.map((p: any) => {
                    const pid = getProductId(p);
                    return (
                      <SelectItem key={pid} value={pid}>{getProductLabel(p)}</SelectItem>
                    );
                  })}
                  {!hasToken && (
                    <SelectItem value="" disabled>Conecta EasyQuote para más productos</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {initialData?.productId && (
                <p className="text-xs text-muted-foreground">Para cambiar el producto, elimina este artículo y crea uno nuevo.</p>
              )}
            </div>

            {/* Mostrar opción elegida al lado del selector cuando hay configuración seleccionada */}
            {needsConfigSelector && boundProductConfig && (
              <div className="space-y-2">
                <Label>Configuración</Label>
                <BoundProductConfigSelector
                  enabledComponents={enabledComponents}
                  value={boundProductConfig}
                  onChange={setBoundProductConfig}
                />
              </div>
            )}

            {/* Solo mostrar nombre cuando NO hay selector de config activo */}
            {productId && !(needsConfigSelector && boundProductConfig) && (
              <div className={`space-y-2 ${needsConfigSelector ? '' : 'md:col-span-2'}`}>
                <Label>Nombre a mostrar del producto</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Editar nombre del producto..."
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Expandable content - only show when expanded */}
      {productId && isExpanded && (
        <div className="grid gap-6 md:grid-cols-5 items-start">
          {/* Left column: options + additionals stack */}
          <div className="md:col-span-3 self-start space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isCustomProduct ? "Detalles" : "Opciones"}</CardTitle>
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
                ) : (
                  <div className="space-y-4">
                    {/* Selector de configuración legacy - mostrar INMEDIATAMENTE sin esperar API */}
                    {needsConfigSelector && !boundProductConfig && (
                      <BoundProductConfigSelector
                        enabledComponents={enabledComponents}
                        value={boundProductConfig}
                        onChange={setBoundProductConfig}
                      />
                    )}

                    {/* Nuevo sistema de productos compuestos con componentes configurados */}
                    {hasConfiguredComponents ? (
                      isCompositeReady ? (
                        <>
                          {/* Selector de componentes: siempre visible para mostrar los activos y permitir añadir */}
                          <div className="mb-4">
                            <label className="text-sm font-medium mb-2 block">Componentes del producto</label>
                            <CompositeComponentsSelector
                              configuredComponents={configuredComponents}
                              activeComponents={activeCompositeComponents}
                              onActiveComponentsChange={setActiveCompositeComponents}
                              productNames={new Map(configuredComponents.map(c => [c.component_product_id, c.component_alias]))}
                            />
                          </div>
                          
                          <CompositeComponentTabs
                            parentProductId={productId}
                            organizationId={organizationId}
                            activeComponents={activeCompositeComponents}
                            parentPromptValues={promptValues}
                            onParentPromptChange={handlePromptChange}
                            onParentPromptCommit={handlePromptCommit}
                            parentProduct={pricing}
                            isAdmin={isSuperAdmin || isOrgAdmin}
                            onComponentChange={setActiveComponent}
                            onComponentsDataChange={(data, total, parentOutputs) => {
                              setCompositeComponentsData(data);
                              setCompositeTotalPrice(total);
                              if (parentOutputs) setCompositeParentOutputs(parentOutputs);
                            }}
                            componentPromptValues={componentPromptValues}
                            onComponentPromptChange={handleComponentPromptChange}
                            onComponentPromptCommit={handleComponentPromptCommit}
                          />
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Cargando configuración...</p>
                      )
                    ) : (
                      /* Sistema legacy para productos encuadernados */
                      <>
                        {/* Mostrar prompts solo si no requiere configuración O ya se seleccionó una */}
                        {(!needsConfigSelector || boundProductConfig) ? (
                          pricing ? (
                            <ComponentTabsPromptsForm
                              product={pricing}
                              productId={productId}
                              values={promptValues}
                              onChange={handlePromptChange}
                              onCommit={handlePromptCommit}
                              showAllPrompts={!!initialData}
                              onComponentChange={setActiveComponent}
                              boundProductConfig={boundProductConfig}
                              isAdmin={isSuperAdmin || isOrgAdmin}
                              onForceResultPrompts={setForceResultPrompts}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">Cargando opciones…</p>
                          )
                        ) : null}
                        
                        {/* Sección: Opciones restrictivas (prompts marcados como force_result) - solo legacy */}
                        {!hasConfiguredComponents && forceResultPrompts.length > 0 && (
                          <div className="border-t pt-4 mt-4">
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                              Opciones restrictivas
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                              {forceResultPrompts.map((prompt) => {
                                const effectiveValue = promptValues[prompt.id];
                                const value = effectiveValue && typeof effectiveValue === 'object' && 'value' in effectiveValue 
                                  ? effectiveValue.value 
                                  : effectiveValue ?? prompt.default;
                                
                                // Checkbox type
                                if (prompt.type === 'checkbox') {
                                  const isChecked = value === true || value === "true" || value === "Sí" || value === "Si" || value === 1 || value === "1";
                                  return (
                                    <div key={prompt.id} className="flex items-center gap-2 py-1">
                                      <span className="text-sm">{prompt.label}</span>
                                      <Checkbox
                                        id={`restrictive-${prompt.id}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          const newValue = checked ? "Sí" : "No";
                                          handlePromptChange(prompt.id, newValue, prompt.label);
                                          handlePromptCommit(prompt.id, newValue, prompt.label);
                                        }}
                                      />
                                    </div>
                                  );
                                }
                                
                                // Select type
                                if (prompt.type === 'select' && prompt.options?.length) {
                                  return (
                                    <div key={prompt.id} className="flex items-center gap-2 py-1">
                                      <span className="text-sm">{prompt.label}</span>
                                      <Select 
                                        value={String(value ?? '')} 
                                        onValueChange={(v) => {
                                          handlePromptChange(prompt.id, v, prompt.label);
                                          handlePromptCommit(prompt.id, v, prompt.label);
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-auto min-w-[100px]">
                                          <SelectValue placeholder="—" />
                                        </SelectTrigger>
                                        <SelectContent className="z-50 bg-popover">
                                          {prompt.options.map((o, idx) => (
                                            <SelectItem key={`${o.value}-${idx}`} value={o.value}>
                                              {o.label ?? o.value}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                }
                                
                                // Number/Integer/Text type
                                return (
                                  <div key={prompt.id} className="flex items-center gap-2 py-1">
                                    <span className="text-sm">{prompt.label}</span>
                                    <Input
                                      type={prompt.type === 'number' || prompt.type === 'integer' ? 'number' : 'text'}
                                      className="h-8 w-24"
                                      value={value ?? ''}
                                      onChange={(e) => handlePromptChange(prompt.id, e.target.value, prompt.label)}
                                      onBlur={(e) => handlePromptCommit(prompt.id, e.target.value, prompt.label)}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additionals Section (kept in left column to avoid blank space) */}
            <Card>
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
                  quantity={isCustomProduct ? customQuantity : (qtyPrompt && promptValues[qtyPrompt]
                    ? parseFloat(String((promptValues[qtyPrompt] as any)?.value ?? promptValues[qtyPrompt]).replace(/\./g, "").replace(",", ".")) || 1
                    : 1)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 md:sticky md:top-6 self-start space-y-3">
            {!isCustomProduct && isPricingError && pricingError && (
              <Alert variant="destructive">
                <AlertTitle>Producto no disponible</AlertTitle>
                <AlertDescription>
                  Este producto no puede ser usado actualmente. Selecciona otro de la lista.
                </AlertDescription>
              </Alert>
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
                    {pricingError && !hasConfiguredComponents && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Producto sin pricing</AlertTitle>
                        <AlertDescription>El producto seleccionado no existe o es incorrecto.</AlertDescription>
                      </Alert>
                    )}

                    {/* Si requiere configuración y no se ha seleccionado, mostrar mensaje */}
                    {!isCompositeReady && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Selecciona el tipo de producto para ver los resultados</p>
                      </div>
                    )}

                    {/* ======= Nuevo sistema de productos compuestos ======= */}
                    {hasConfiguredComponents && isCompositeReady && (
                      <>
                        {/* Precio Total del producto compuesto */}
                        <div className="p-3 rounded-md border bg-accent/10 mb-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              {userEditedPrice !== null ? "Precio calculado" : "Precio Total"}
                            </span>
                            <span
                              className={
                                userEditedPrice !== null
                                  ? "text-sm text-muted-foreground line-through"
                                  : "text-lg font-semibold"
                              }
                            >
                              {formatEUR(compositeTotalPrice)}
                            </span>
                          </div>

                          {userEditedPrice !== null && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-muted-foreground">Precio modificado</span>
                              <span className="text-lg font-semibold text-primary">{formatEUR(userEditedPrice)}</span>
                            </div>
                          )}

                          {canEditPrice && (
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUserEditedPrice(userEditedPrice === null ? compositeTotalPrice : null)}
                              >
                                {userEditedPrice !== null ? "Usar precio calculado" : "Editar precio"}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Datos de salida: generales del padre + tabs para componente seleccionado */}
                        {(() => {
                          // Outputs del padre (ancho, alto, etc.)
                          const parentTextOutputs: { label: string; value: string }[] = [];
                          
                          (compositeParentOutputs || []).forEach((o: any) => {
                            const value = String(o?.value ?? "");
                            const type = String(o?.type || o?.outputType || "").toLowerCase();
                            const label = o.label || o.name || "";
                            
                            if (type !== "price" && value.trim() && !/^https?:\/\//i.test(value)) {
                              parentTextOutputs.push({ label, value });
                            }
                          });

                          // Obtener outputs del componente seleccionado
                          const selectedCompData = compositeComponentsData[activeComponent];
                          const selectedOutputs = selectedCompData?.outputs || [];
                          const selectedTextOutputs: { label: string; value: string }[] = [];
                          const selectedImageOutputs: { label: string; value: string }[] = [];

                          selectedOutputs.forEach((o: any) => {
                            const value = String(o?.value ?? "");
                            const type = String(o?.type || o?.outputType || "").toLowerCase();
                            const label = o.label || o.name || "";
                            
                            if (/^https?:\/\//i.test(value)) {
                              selectedImageOutputs.push({ label, value });
                            } else if (type !== "price" && value.trim()) {
                              selectedTextOutputs.push({ label, value });
                            }
                          });

                          const hasAnyLoading = Object.values(compositeComponentsData).some((d: any) => d?.isLoading);
                          const componentEntries = Object.entries(compositeComponentsData);

                          if (hasAnyLoading) {
                            return <p className="text-sm text-muted-foreground">Calculando datos de salida...</p>;
                          }

                          return (
                            <>
                              {/* Outputs generales del padre (ancho, alto, etc.) */}
                              {parentTextOutputs.length > 0 && (
                                <div className="space-y-2 text-sm">
                                  {parentTextOutputs.map((output, index) => (
                                    <div key={`parent-${index}`} className="flex justify-between px-1">
                                      <span className="text-muted-foreground">{output.label}</span>
                                      <span className="font-medium truncate ml-2">{output.value}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Tabs y outputs del componente seleccionado */}
                              {componentEntries.length > 0 && (
                                <div className="border-t pt-4 mt-4 space-y-4">
                                  {componentEntries.length > 1 && (
                                    <Tabs value={activeComponent} onValueChange={setActiveComponent}>
                                      <TabsList className="w-full">
                                        {componentEntries.map(([compId, data]) => (
                                          <TabsTrigger key={compId} value={compId} className="flex-1">
                                            {(data as any).alias}
                                          </TabsTrigger>
                                        ))}
                                      </TabsList>
                                    </Tabs>
                                  )}
                                  
                                  {componentEntries.length === 1 && selectedCompData && (
                                    <h4 className="font-semibold text-sm">{selectedCompData.alias}</h4>
                                  )}

                                  {selectedCompData && (
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between px-1">
                                        <span className="text-muted-foreground">Precio</span>
                                        <span className="font-medium">{formatEUR(selectedCompData.price ?? 0)}</span>
                                      </div>
                                      {selectedTextOutputs.map((output, index) => (
                                        <div key={`sel-${index}`} className="flex justify-between px-1">
                                          <span className="text-muted-foreground">{output.label}</span>
                                          <span className="font-medium truncate ml-2">{output.value}</span>
                                        </div>
                                      ))}
                                      {selectedImageOutputs.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                          {selectedImageOutputs.map((output, index) => (
                                            <div key={`sel-img-${index}`} className="space-y-2">
                                              <div className="text-sm font-medium">{output.label}</div>
                                              <img src={output.value} alt={output.label || `Imagen ${index + 1}`} className="w-full max-w-md rounded border" />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {selectedTextOutputs.length === 0 && selectedImageOutputs.length === 0 && (
                                        <p className="text-muted-foreground">Sin datos de salida</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {parentTextOutputs.length === 0 && componentEntries.length === 0 && (
                                <p className="text-sm text-muted-foreground">Sin datos de salida adicionales</p>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}

                    {/* ======= Sistema legacy ======= */}
                    {!hasConfiguredComponents && isCompositeReady && (
                      <ComponentTabsOutputs
                        productId={productId}
                        outputs={sortedOutputs}
                        activeComponent={activeComponent}
                        isLoading={isPricingLoading}
                        savedOutputOrder={savedOutputOrder}
                        boundProductConfig={boundProductConfig}
                        editablePrice={userEditedPrice}
                        onPriceChange={(price) => setUserEditedPrice(price)}
                        multiEnabled={multiEnabled}
                        canEditPrice={canEditPrice}
                        renderPrice={() => {
                          // MOSTRAR SIEMPRE el output con type=Price (sin IVA). Fallback: pricing.price.
                          const outputPrice = (priceOutput as any)?.value;
                          const pricingPrice = (pricing as any)?.price;
                          const displayPrice = outputPrice !== undefined && outputPrice !== null
                            ? outputPrice
                            : pricingPrice;
                          
                          return displayPrice !== undefined && displayPrice !== null ? (
                            <div className="p-3 rounded-md border bg-card/50">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Precio</span>
                                <span className="px-2 py-1 rounded-full bg-accent text-accent-foreground text-lg font-semibold">
                                  {formatEUR(displayPrice)}
                                </span>
                              </div>
                            </div>
                          ) : (!pricingError ? <p className="text-sm text-muted-foreground">Selecciona opciones para ver el resultado.</p> : null);
                        }}
                        renderImages={(images) => (
                          <section className={images.length === 1 ? "flex justify-center" : "grid grid-cols-2 gap-3"}>
                            {images.map((o: any, idx: number) => (
                              <img 
                                key={`${o.value}-${idx}`}
                                src={String(o.value)} 
                                alt={`resultado imagen ${idx + 1}`} 
                                loading="lazy" 
                                className={images.length === 1 ? "max-w-[180px] w-full h-auto rounded-md" : "w-full h-auto rounded-md"}
                              />
                            ))}
                          </section>
                        )}
                        renderOutput={(o, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm px-1">
                            <span className="text-muted-foreground">{o.name ?? "Resultado"}</span>
                            <span className="truncate ml-2">{String(o.value)}</span>
                          </div>
                        )}
                      />
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
                            value={localQtyInputs[0] ?? ""}
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
                              value={localQtyInputs[idx] ?? ""}
                              onChange={(e) => {
                                // Solo actualizar estado local mientras se escribe
                                const v = e.target.value;
                                setLocalQtyInputs((prev) => {
                                  const next = [...prev];
                                  next[idx] = v;
                                  return next;
                                });
                              }}
                              onBlur={(e) => {
                                // Commitear al estado principal en blur
                                const v = e.target.value;
                                setQtyInputs((prev) => {
                                  const next = [...prev];
                                  next[idx] = v;
                                  return next;
                                });
                              }}
                              onKeyDown={(e) => {
                                // Commitear en Enter
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="px-2"
                            />
                          </div>
                        ))}
                      </div>

                       {(multiLoading || compositeMultiLoading) ? (
                        <p className="text-sm text-muted-foreground">Calculando...</p>
                      ) : (Array.isArray(multiRows) && multiRows.length > 0 ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {multiRows.map((r, idx) => {
                              const calculatedPriceRaw = getCalculatedPriceFromOutputs(r.outs || []);
                              const calculatedPrice = Number.isFinite(calculatedPriceRaw) ? calculatedPriceRaw : 0;
                              const modifiedPrice = multiModifiedPrices[idx];
                              const hasModified = modifiedPrice !== null && modifiedPrice !== undefined && modifiedPrice !== calculatedPrice;
                              const displayPrice = hasModified ? modifiedPrice : calculatedPrice;
                              const formattedPrice = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayPrice);
                              const formattedCalculated = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(calculatedPrice);
                              
                              // Calculate additionals for this specific quantity
                              const additionals = calculateAdditionalsForQty(r.qty);
                              const hasAdditionals = additionals.breakdown.length > 0;
                              const totalWithAdditionals = displayPrice + additionals.total;
                              
                              return (
                                <div key={idx} className="border rounded p-2 space-y-1">
                                  <div className="text-xs text-muted-foreground mb-1 font-medium">Q{idx + 1} ({r.qty} uds)</div>
                                  
                                  {editingMultiPriceIdx === idx ? (
                                    <div className="space-y-1">
                                      <Input
                                        type="text"
                                        value={localMultiPriceInput}
                                        onChange={(e) => setLocalMultiPriceInput(e.target.value)}
                                        className="h-7 text-xs"
                                        autoFocus
                                      />
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          className="h-6 text-xs flex-1"
                                          onClick={() => {
                                            const parsed = parseFloat(localMultiPriceInput.replace(/\./g, "").replace(",", ".")) || 0;
                                            setMultiModifiedPrices(prev => ({
                                              ...prev,
                                              [idx]: parsed > 0 ? parsed : null
                                            }));
                                            setEditingMultiPriceIdx(null);
                                          }}
                                        >
                                          OK
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-xs flex-1"
                                          onClick={() => setEditingMultiPriceIdx(null)}
                                        >
                                          ✕
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {hasModified && (
                                        <div className="text-xs text-muted-foreground line-through">{formattedCalculated} €</div>
                                      )}
                                      {canEditPrice ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setLocalMultiPriceInput(displayPrice.toFixed(2).replace(".", ","));
                                            setEditingMultiPriceIdx(idx);
                                          }}
                                          className="text-sm font-semibold hover:text-primary transition-colors"
                                        >
                                          {formattedPrice} €
                                        </button>
                                      ) : (
                                        <span className="text-sm font-semibold">{formattedPrice} €</span>
                                      )}
                                      {hasModified && canEditPrice && (
                                        <button
                                          type="button"
                                          onClick={() => setMultiModifiedPrices(prev => ({ ...prev, [idx]: null }))}
                                          className="block text-[10px] text-muted-foreground hover:text-foreground"
                                        >
                                          Usar calculado
                                        </button>
                                      )}
                                      
                                      {/* Additionals breakdown for this quantity */}
                                      {hasAdditionals && (
                                        <div className="mt-2 pt-2 border-t border-dashed space-y-1">
                                          {additionals.breakdown.map((add, addIdx) => (
                                            <div key={addIdx} className="flex justify-between text-[10px] text-muted-foreground">
                                              <span className="truncate max-w-[80px]">{add.name}</span>
                                              <span className={add.value >= 0 ? "" : "text-green-600"}>
                                                {add.value >= 0 ? "+" : ""}{new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(add.value)} €
                                              </span>
                                            </div>
                                          ))}
                                          <div className="flex justify-between text-xs font-medium pt-1 border-t">
                                            <span>Total</span>
                                            <span>{new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalWithAdditionals)} €</span>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
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
