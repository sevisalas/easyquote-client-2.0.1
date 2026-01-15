import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction, getEasyQuoteToken } from "@/lib/easyquoteApi";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import PromptsForm, { type PromptDef } from "@/components/quotes/PromptsForm";
import ComponentTabsPromptsForm, { COMPONENT_LABELS } from "@/components/quotes/ComponentTabsPromptsForm";
import BoundProductConfigSelector, { 
  type BoundProductConfig, 
  getAvailableConfigs,
  getActiveComponents
} from "@/components/quotes/BoundProductConfigSelector";
import { useProductComponentSettings } from "@/hooks/useProductComponentSettings";
import { ArrowLeft, AlertCircle, Package, Boxes } from "lucide-react";
import { Link } from "react-router-dom";

const fetchProducts = async () => {
  // Use getEasyQuoteToken which validates and auto-refreshes expired tokens
  const token = await getEasyQuoteToken();
  if (!token) throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
  const {
    data,
    error
  } = await invokeEasyQuoteFunction("easyquote-products", {
    token,
    includeInactive: true // Get all products to see plan compliance
  });
  if (error) throw error;
  const list = Array.isArray(data) ? data : data?.items || data?.data || [];
  return list.filter((product: any) => product.isActive === true);
};
const getProductLabel = (p: any) => p?.name ?? p?.title ?? p?.displayName ?? p?.productName ?? p?.product_name ?? p?.nombre ?? p?.Nombre ?? p?.description ?? "Producto sin nombre";
export default function ProductTestPage() {
  const [searchParams] = useSearchParams();
  const [productId, setProductId] = useState<string>("");
  const [promptValues, setPromptValues] = useState<Record<string, any>>({});
  const [debouncedPromptValues, setDebouncedPromptValues] = useState<Record<string, any>>({});
  // Prompts que el usuario ha "limpiado" explícitamente (para que NO se envíen en el PATCH)
  // Importante: EasyQuote valida el PATCH y rechaza value: "" en prompts numéricos.
  const [clearedPromptIds, setClearedPromptIds] = useState<Record<string, true>>({});
  const [productDetail, setProductDetail] = useState<any>(null);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasUserModifiedPrompts, setHasUserModifiedPrompts] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string>('general');
  const [boundProductConfig, setBoundProductConfig] = useState<BoundProductConfig | null>(null);
  const [modifiedPrice, setModifiedPrice] = useState<number | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [localPriceInput, setLocalPriceInput] = useState("");
  const [tokenReady, setTokenReady] = useState(!!sessionStorage.getItem("easyquote_token"));
  const [forceResultPrompts, setForceResultPrompts] = useState<PromptDef[]>([]);
  
  // Ref para el timeout del debounce de commit de prompts
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialView = searchParams.get('view') === 'componentes' ? 'componentes' : 'productos';
  const [viewMode, setViewMode] = useState<'productos' | 'componentes'>(initialView);
  const {
    isSuperAdmin,
    isOrgAdmin,
    organization,
    membership
  } = useSubscription();
  
  // Check if product is composite
  const { isComposite, enabledComponents, getPromptComponent } = useProductComponentSettings(productId || undefined);
  const queryClient = useQueryClient();
  
  const organizationId = organization?.id || membership?.organization_id;

  // Fetch component product IDs
  const { data: componentProductIds = new Set<string>() } = useQuery({
    queryKey: ["component-product-ids", organizationId],
    queryFn: async () => {
      if (!organizationId) return new Set<string>();
      const { data, error } = await supabase
        .from("product_component_settings")
        .select("easyquote_product_id")
        .eq("organization_id", organizationId)
        .eq("is_component", true);
      if (error) {
        console.error("Error fetching component products:", error);
        return new Set<string>();
      }
      return new Set((data || []).map((d) => d.easyquote_product_id));
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Determinar si el producto necesita selector de configuración (tiene múltiples componentes)
  const availableConfigs = useMemo(() => {
    if (!isComposite || !productId) return [];
    return getAvailableConfigs(enabledComponents);
  }, [isComposite, enabledComponents, productId]);
  
  const needsConfigSelector = availableConfigs.length > 0;
  // Fetch saved output order from Supabase
  const { data: savedOutputOrder } = useQuery({
    queryKey: ["product-output-order", productId, organizationId],
    queryFn: async () => {
      if (!productId || !organizationId) return null;
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
    enabled: !!productId && !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch output definitions so we can map calculated outputs back to their stable IDs
  const { data: outputDefinitions = [] } = useQuery({
    queryKey: ["easyquote-output-definitions", productId],
    queryFn: async () => {
      if (!productId) return [];
      const token = await getEasyQuoteToken();
      if (!token) return [];

      const { data, error } = await invokeEasyQuoteFunction("easyquote-outputs", {
        token,
        productId,
      });

      if (error) {
        console.error("Error fetching output definitions:", error);
        return [];
      }

      const list = Array.isArray(data) ? data : data?.items || data?.data || [];
      console.log("📋 Output definitions FULL:", JSON.stringify(list.slice(0, 3), null, 2));
      return Array.isArray(list) ? list : [];
    },
    enabled: !!productId && tokenReady,
    staleTime: 5 * 60 * 1000,
  });

  // Output definitions NO incluyen el nombre/label; solo outputTypeId + celdas.
  // Para poder asignar una celda a cada output calculado (pricing), necesitamos traducir outputTypeId -> nombre de tipo.
  const { data: outputTypes = [] } = useQuery({
    queryKey: ["easyquote-output-types"],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const resp = await fetch("https://api.easyquote.cloud/api/v1/products/outputs/types", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: tokenReady,
    staleTime: 60 * 60 * 1000, // 1h: tipos cambian muy rara vez
    refetchOnWindowFocus: false,
  });

  const outputTypeNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of outputTypes as any[]) {
      const id = Number(t?.id);
      const name = String(t?.name ?? "").trim();
      if (Number.isFinite(id) && name) map.set(id, name);
    }
    return map;
  }, [outputTypes]);

  // Ordenamos definiciones usando primero el orden guardado (product_output_order.output_order)
  // y luego un fallback por hoja+celda.
  const orderedOutputDefinitions = useMemo(() => {
    const normalizeCell = (v: any) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
    const normalizeSheet = (v: any) => String(v ?? "").trim().toUpperCase();

    const parseCell = (cellRaw: string) => {
      const cell = normalizeCell(cellRaw);
      const m = cell.match(/^([A-Z]+)(\d+)$/);
      if (!m) return null;
      const [, letters, rowStr] = m;
      const row = Number(rowStr);
      const col = letters.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0); // A=1
      if (!Number.isFinite(row) || row <= 0 || col <= 0) return null;
      return { col, row };
    };

    const orderMap = new Map<string, number>(
      (savedOutputOrder ?? []).map((cell: string, idx: number) => [normalizeCell(cell), idx])
    );

    return (outputDefinitions as any[])
      .map((d: any, index: number) => {
        const outputTypeId = Number(d?.outputTypeId);
        const outputTypeName = String(outputTypeNameById.get(outputTypeId) ?? "")
          .trim()
          .toLowerCase();

        const sheetKey = normalizeSheet(d?.sheet);
        const cellKey = normalizeCell(d?.nameCell);
        const orderIdx = orderMap.has(cellKey) ? orderMap.get(cellKey)! : 9999;
        const parsed = cellKey ? parseCell(cellKey) : null;

        return {
          ...d,
          outputTypeName,
          __index: index,
          __orderIdx: orderIdx,
          __sheetKey: sheetKey,
          __cellKey: cellKey,
          __parsed: parsed,
        };
      })
      .sort((a: any, b: any) => {
        if (a.__orderIdx !== b.__orderIdx) return a.__orderIdx - b.__orderIdx;
        if (a.__sheetKey !== b.__sheetKey) return a.__sheetKey.localeCompare(b.__sheetKey);

        const aHas = !!a.__parsed;
        const bHas = !!b.__parsed;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (a.__parsed && b.__parsed) {
          if (a.__parsed.col !== b.__parsed.col) return a.__parsed.col - b.__parsed.col;
          if (a.__parsed.row !== b.__parsed.row) return a.__parsed.row - b.__parsed.row;
        }
        return a.__index - b.__index;
      });
  }, [outputDefinitions, outputTypeNameById, savedOutputOrder]);

  const outputDefIdByCells = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of outputDefinitions as any[]) {
      const sheet = String(o?.sheet ?? "").trim();
      const nameCell = String(o?.nameCell ?? "").trim();
      const valueCell = String(o?.valueCell ?? "").trim();
      const id = String(o?.id ?? "").trim();
      if (!id || !nameCell || !valueCell) continue;
      map.set(`${sheet}|${nameCell}|${valueCell}`, id);
    }
    return map;
  }, [outputDefinitions]);

  const outputDefIdByNameValueCells = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of outputDefinitions as any[]) {
      const nameCell = String(o?.nameCell ?? "").trim();
      const valueCell = String(o?.valueCell ?? "").trim();
      const id = String(o?.id ?? "").trim();
      if (!id || !nameCell || !valueCell) continue;
      map.set(`${nameCell}|${valueCell}`, id);
    }
    return map;
  }, [outputDefinitions]);

  // Listen for token updates to trigger product fetch immediately
  useEffect(() => {
    const handleTokenUpdate = () => {
      setTokenReady(true);
      queryClient.invalidateQueries({
        queryKey: ["easyquote-products-test-page"]
      });
    };

    // Check immediately if token exists
    if (sessionStorage.getItem("easyquote_token")) {
      setTokenReady(true);
    }
    window.addEventListener('easyquote-token-updated', handleTokenUpdate);
    return () => window.removeEventListener('easyquote-token-updated', handleTokenUpdate);
  }, [queryClient]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }
    };
  }, []);

  // Fetch products - with aggressive caching (separate key to avoid conflicts)
  const {
    data: allProducts = [],
    isLoading
  } = useQuery({
    queryKey: ["easyquote-products-test-page"],
    queryFn: fetchProducts,
    enabled: tokenReady,
    staleTime: 10 * 60 * 1000,
    // 10 minutes - products rarely change
    gcTime: 30 * 60 * 1000 // 30 minutes cache
  });

  // Filter products based on viewMode
  const products = useMemo(() => {
    return allProducts.filter((p: any) => {
      const isProductComponent = componentProductIds.has(p.id);
      if (viewMode === 'productos') return !isProductComponent;
      return isProductComponent;
    });
  }, [allProducts, componentProductIds, viewMode]);

  // Reset productId when switching viewMode if current product doesn't match the new filter
  useEffect(() => {
    if (productId) {
      const isProductComponent = componentProductIds.has(productId);
      const matchesCurrentView = viewMode === 'productos' ? !isProductComponent : isProductComponent;
      if (!matchesCurrentView) {
        setProductId("");
        setProductDetail(null);
      }
    }
  }, [viewMode, componentProductIds, productId]);

  // Fetch product detail when productId changes - with retries for transient errors
  // Note: We only depend on productId, not products, to avoid re-fetching on every products array change
  useEffect(() => {
    const fetchProductDetail = async (retryCount = 0) => {
      const MAX_RETRIES = 2;
      let scheduledRetry = false;

      if (!productId) {
        console.log("🔴 No productId selected");
        setProductDetail(null);
        setIsLoadingProduct(false);
        return;
      }

      // Clear previous state immediately when starting a new fetch
      // This ensures we don't send stale prompt IDs from a previous product
      if (retryCount === 0) {
        setPromptValues({});
        setDebouncedPromptValues({});
      }

      console.log(
        "🟢 Starting to fetch product detail for:",
        productId,
        retryCount > 0 ? `(retry ${retryCount})` : ""
      );

      setIsLoadingProduct(true);
      if (retryCount === 0) {
        setIsInitialLoad(true);
        setHasUserModifiedPrompts(false);
        setDiagnosticResult(null);
        setProductLoadError(null);
        setBoundProductConfig(null);
        setProductDetail(null); // Clear previous product detail
      }

      const token = await getEasyQuoteToken();
      if (!token) {
        console.error("🔴 No EasyQuote token available");
        setProductLoadError("Falta token de EasyQuote. Inicia sesión de nuevo.");
        setProductDetail(null);
        setPromptValues({});
        setIsInitialLoad(false);
        setIsLoadingProduct(false);
        return;
      }

      console.log("✅ EasyQuote token obtained");
      try {
        console.log("📡 Calling easyquote-pricing...");
        const { data: pricingData, error: pricingError } = await invokeEasyQuoteFunction(
          "easyquote-pricing",
          {
            token,
            productId: productId,
            inputs: [],
          }
        );
        if (pricingError) {
          console.error("🔴 Pricing error:", pricingError);
          throw pricingError;
        }

        console.log("✅ Pricing data received:", pricingData);
        console.log("📋 Prompts from pricing:", pricingData?.prompts?.length || 0);
        console.log("📋 Prompt types:", (pricingData?.prompts || []).map((p: any) => ({
          id: p.id,
          type: p.promptType,
          text: p.promptText?.substring(0, 30)
        })));
        
        // Validate that we got fresh data with productId
        const responseProductId = pricingData?.productID || pricingData?.productId;
        if (responseProductId && responseProductId !== productId) {
          console.warn("⚠️ Response productId mismatch:", responseProductId, "vs", productId);
        }
        
        setProductDetail(pricingData);
        setProductLoadError(null);

        // Reset prompt values with current values from pricing
        const currentValues: Record<string, any> = {};
        (pricingData?.prompts || []).forEach((prompt: any) => {
          if (prompt.currentValue !== undefined && prompt.currentValue !== null) {
            currentValues[prompt.id] = prompt.currentValue;
          }
        });
        console.log("📋 Initial prompt values:", currentValues);
        setPromptValues(currentValues);
        setDebouncedPromptValues(currentValues);
        setIsInitialLoad(false);
      } catch (error: any) {
        console.error("🔴 Error fetching product detail:", error);

        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          console.log(`⏳ Reintentando en ${delay}ms...`);
          scheduledRetry = true;
          setTimeout(() => fetchProductDetail(retryCount + 1), delay);
          return;
        }

        const msg = error?.message || "Error al cargar el producto";
        setProductLoadError(msg);
        toast({
          title: "Error al cargar el producto",
          description: msg,
          variant: "destructive",
        });
        setProductDetail(null);
        setPromptValues({});
        setIsInitialLoad(false);
      } finally {
        if (!scheduledRetry) {
          setIsLoadingProduct(false);
        }
      }
    };
    fetchProductDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Fetch pricing data ONLY when user modifies prompts (not on initial load)
  const {
    data: pricing,
    isLoading: pricingLoading,
    refetch: refetchPricing
  } = useQuery({
    queryKey: ["easyquote-pricing", productId, debouncedPromptValues],
    enabled: !!productId && !isInitialLoad && hasUserModifiedPrompts,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 30 * 1000,
    // 30 seconds - pricing can be cached briefly
    gcTime: 60 * 1000,
    // 1 minute cache
    queryFn: async () => {
      // Use getEasyQuoteToken which validates and auto-refreshes expired tokens
      const token = await getEasyQuoteToken();
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      console.log("Making pricing call with inputs:", debouncedPromptValues);

      // CRITICAL: EasyQuote API PATCH requires ALL prompts to be sent, not just modified ones
      // Start with all prompt values from productDetail (current values from API)
      // IMPORTANT: Always use string keys to ensure consistent matching with debouncedPromptValues
      const allPromptValues: Record<string, any> = {};

      // First, collect all current values from the product prompts (using string keys)
      (productDetail?.prompts || []).forEach((p: any) => {
        if (p.currentValue !== undefined && p.currentValue !== null) {
          const key = String(p.id); // Normalize to string
          allPromptValues[key] = p.currentValue;
        }
      });

      // Override with user-modified values (keys are already strings from state)
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          allPromptValues[k] = v;
        }
      });
      console.log("All prompt values (merged):", allPromptValues);

      // Now normalize all values for the API
      const norm: Record<string, any> = {};
      Object.entries(allPromptValues).forEach(([k, v]) => {
        // Skip undefined/null but ALLOW empty strings (need to send "" to Excel)
        if (v === undefined || v === null) return;

        // Find the prompt to check its type (compare as strings for consistent matching)
        const prompt = productDetail?.prompts?.find((p: any) => String(p.id) === k);
        const promptType = prompt?.promptType;
        if (typeof v === "string") {
          const trimmed = v.trim();

          // Allow empty strings - they need to be sent to Excel
          if (trimmed === "") {
            norm[k] = "";
            return;
          }

          // Skip strings that are only special characters without meaningful content
          // (e.g., "," or "." or "-" by themselves)
          if (trimmed.length < 3 && /^[^\w\s]+$/.test(trimmed)) {
            console.warn(`⚠️ Skipping invalid value for prompt ${k}:`, v);
            return;
          }
          const isHex = /^#[0-9a-f]{6}$/i.test(trimmed);
          if (isHex) {
            // Remove the # for color values as API expects without #
            norm[k] = trimmed.substring(1).toUpperCase();
          } else {
            // Only convert to number if the prompt type is numeric (Number or Quantity)
            const isNumericType = promptType === "Number" || promptType === "Quantity";
            if (isNumericType) {
              const asNum = parseFloat(trimmed);
              norm[k] = Number.isNaN(asNum) ? trimmed : asNum;
            } else {
              // For dropdown and other types, keep as string
              norm[k] = trimmed;
            }
          }
        } else if (typeof v === "number") {
          // Skip invalid numbers
          if (!isFinite(v)) {
            console.warn(`⚠️ Skipping invalid number for prompt ${k}:`, v);
            return;
          }
          norm[k] = v;
        } else {
          norm[k] = v;
        }
      });

      // Convert to array format for API
      const inputsArray = Object.entries(norm).map(([id, value]) => ({
        id,
        value
      }));
      console.log("Sending ALL prompts to API:", inputsArray.length, "prompts", inputsArray);
      const {
        data,
        error
      } = await invokeEasyQuoteFunction("easyquote-pricing", {
        token,
        productId,
        inputs: inputsArray
      });
      if (error) {
        toast({
          title: "Error al calcular precio",
          description: error?.message || "EasyQuote devolvió un error",
          variant: "destructive",
        });
        return null as any;
      }
      console.log("Pricing data received:", data);
      console.log("Pricing outputValues:", data?.outputValues);
      console.log("Pricing price field:", data?.price);
      console.log("All pricing fields:", Object.keys(data || {}));

      // Update product detail with new prompts structure (for updated options)
      if (data?.prompts) {
        setProductDetail(prevDetail => ({
          ...prevDetail,
          prompts: data.prompts
        }));
      }
      return data;
    }
  });

  // Auto-select product if productId is in URL params
  useEffect(() => {
    const productIdFromUrl = searchParams.get("productId");
    if (productIdFromUrl && products.length > 0) {
      const productExists = products.find((p: any) => p.id === productIdFromUrl);
      if (productExists) {
        setProductId(productIdFromUrl);
      }
    }
  }, [searchParams, products]);

  // Derive outputs from pricing data - based on real API response structure
  const outputs = useMemo(() => {
    const source = pricing || productDetail;
    if (!source) return [];

    // EasyQuote API returns outputs in 'outputValues' (GET) or 'outputs' (PATCH)
    const outputValues = source.outputValues || source.outputs || source.results || [];

    // Normalize output structure
    const normalized = Array.isArray(outputValues)
      ? outputValues.map((o: any, pos: number) => {
          const idxRaw = Number(o?.idx ?? o?.index ?? o?.orderSeq ?? o?.outputIndex ?? o?.order ?? NaN);
          const idx = Number.isFinite(idxRaw) ? idxRaw : undefined;

          return {
            // Posición en el array (fallback fiable cuando GET no devuelve idx/nameCell)
            __pos: pos,
            // Algunos responses incluyen un índice estable que puede corresponder al orden original de definiciones
            idx,
            // Some API responses include a stable output id
            stableId: String(o?.id ?? o?.outputId ?? o?.outputID ?? "").trim(),
            // Some responses include sheet/cell coordinates (useful for ordering)
            sheet: String(o?.sheet ?? "").trim(),
            nameCell: String(o?.nameCell ?? o?.outputNameCell ?? "").trim(),
            valueCell: String(o?.valueCell ?? o?.outputValueCell ?? "").trim(),
            label: o.label || o.name || o.outputText || o.text || o.outputName || "",
            name: o.name || o.label || o.outputName || "",
            value: o.value ?? o.currentValue ?? o.outputValue ?? o.result ?? "",
            outputType: o.outputType || o.type || "",
          };
        })
      : [];

    return normalized;
  }, [pricing, productDetail]);

  // Enrich outputs con sheet/nameCell reales:
  // - easyquote-pricing (GET) devuelve outputValues sin celdas
  // - easyquote-outputs devuelve celdas pero sin nombre
  // => asignamos celdas por tipo usando outputTypeId -> typeName y el orden guardado por celdas.
  const allOutputs = useMemo(() => {
    const normalizeType = (v: any) => String(v ?? "").trim().toLowerCase();
    const normalizeId = (v: any) => String(v ?? "").trim();

    // 1) Mejor caso: si pricing devuelve un id estable, lo asociamos directamente a la definición
    const defById = new Map<string, any>();

    // 2) Segundo mejor caso: si pricing devuelve idx, lo asociamos al índice original de definiciones
    const defByOriginalIndex = new Map<number, any>();

    for (const d of orderedOutputDefinitions as any[]) {
      const id = normalizeId(d?.id);
      if (id) defById.set(id, d);

      const originalIndex = Number(d?.__index);
      if (Number.isFinite(originalIndex)) defByOriginalIndex.set(originalIndex, d);
    }

    // IMPORTANTE: en algunos productos, EasyQuote devuelve `outputValues` en el orden
    // "tal cual" del Excel (índice posicional), pero nuestras definiciones pueden estar
    // re-ordenadas (por celda/hoja o por orden guardado). Para evitar que Interior 2
    // termine mapeando celdas/hojas de Interior 1, también mantenemos un lookup por
    // índice ya ordenado.
    const defBySortedIndex = new Map<number, any>();
    (orderedOutputDefinitions as any[]).forEach((d: any, sortedIndex: number) => {
      defBySortedIndex.set(sortedIndex, d);
    });

    const getDefByIndex = (n: number) => defByOriginalIndex.get(n) ?? defBySortedIndex.get(n);
    // 3) Fallback: asignación por tipo (cuando no hay id/idx/pos fiables en pricing)
    const defsByType = new Map<string, any[]>();
    for (const d of orderedOutputDefinitions as any[]) {
      const t = normalizeType(d?.outputTypeName);
      if (!t) continue;
      if (!defsByType.has(t)) defsByType.set(t, []);
      defsByType.get(t)!.push(d);
    }

    const counters = new Map<string, number>();

    return outputs.map((o: any) => {
      // Si ya viene con celda (p.ej. PATCH), respetarla
      if (o?.nameCell) return o;

      const stableId = normalizeId(o?.stableId);
      if (stableId && defById.has(stableId)) {
        const def = defById.get(stableId);
        return {
          ...o,
          stableId,
          sheet: o.sheet || String(def?.sheet ?? "").trim(),
          nameCell: String(def?.nameCell ?? "").trim(),
          valueCell: o.valueCell || String(def?.valueCell ?? "").trim(),
        };
      }

      const idxRaw = Number(o?.idx);
      if (Number.isFinite(idxRaw)) {
        // Algunas APIs devuelven idx 0-based; otras 1-based. Probamos ambos.
        const def = getDefByIndex(idxRaw) ?? getDefByIndex(idxRaw - 1);
        if (def) {
          return {
            ...o,
            stableId: stableId || normalizeId(def?.id),
            sheet: o.sheet || String(def?.sheet ?? "").trim(),
            nameCell: String(def?.nameCell ?? "").trim(),
            valueCell: o.valueCell || String(def?.valueCell ?? "").trim(),
          };
        }
      }

      // Fallback: respetar el orden del array devuelto por pricing
      const posRaw = Number(o?.__pos);
      if (Number.isFinite(posRaw)) {
        const def = getDefByIndex(posRaw);
        if (def) {
          return {
            ...o,
            stableId: stableId || normalizeId(def?.id),
            sheet: o.sheet || String(def?.sheet ?? "").trim(),
            nameCell: String(def?.nameCell ?? "").trim(),
            valueCell: o.valueCell || String(def?.valueCell ?? "").trim(),
          };
        }
      }

      const t = normalizeType(o?.outputType);
      const defs = defsByType.get(t);
      if (!defs || defs.length === 0) return o;

      const i = counters.get(t) ?? 0;
      const def = defs[i];
      counters.set(t, i + 1);
      if (!def) return o;

      return {
        ...o,
        stableId: stableId || normalizeId(def?.id),
        sheet: o.sheet || String(def?.sheet ?? "").trim(),
        nameCell: String(def?.nameCell ?? "").trim(),
        valueCell: o.valueCell || String(def?.valueCell ?? "").trim(),
      };
    });
  }, [outputs, orderedOutputDefinitions]);

  // Ordenar outputs por celda (columna, luego fila): E5, E8, E9, E12...
  const sortedOutputs = useMemo(() => {
    const parseCell = (cellRaw: string) => {
      const cell = String(cellRaw ?? "").replace(/\$/g, "").trim().toUpperCase();
      const m = cell.match(/^([A-Z]+)(\d+)$/);
      if (!m) return null;
      const [, letters, rowStr] = m;
      const row = Number(rowStr);
      const col = letters.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
      return { col, row };
    };

    return [...allOutputs].sort((a: any, b: any) => {
      const cellA = String(a?.nameCell ?? "").replace(/\$/g, "").trim().toUpperCase();
      const cellB = String(b?.nameCell ?? "").replace(/\$/g, "").trim().toUpperCase();
      
      const parsedA = parseCell(cellA);
      const parsedB = parseCell(cellB);
      
      if (parsedA && parsedB) {
        if (parsedA.col !== parsedB.col) return parsedA.col - parsedB.col;
        return parsedA.row - parsedB.row;
      }
      
      if (parsedA && !parsedB) return -1;
      if (!parsedA && parsedB) return 1;
      return 0;
    });
  }, [allOutputs]);

  // Agrupar outputs por componente usando asignaciones guardadas + fallback por hoja
  
  const outputsByComponent = useMemo(() => {
    const grouped: Record<string, any[]> = { general: [] };
    const availableComponents = ["general", ...(enabledComponents ?? [])];

    // Mapear nombres de hoja comunes a componentes (fallback)
    const sheetNameToComponent: Record<string, string> = {
      cubierta: "cubierta",
      cover: "cubierta",
      interior: "interior_1",
      "interior 1": "interior_1",
      interior_1: "interior_1",
      interior1: "interior_1",
      "interior 2": "interior_2",
      interior_2: "interior_2",
      interior2: "interior_2",
    };

    const inferComponentFromSheet = (sheet: any): string => {
      const raw = String(sheet ?? "").trim();
      const norm = raw.toLowerCase().trim();
      if (!norm) return "general";

      if (sheetNameToComponent[norm]) return sheetNameToComponent[norm];

      const m = norm.match(/\d+/);
      if (m) {
        const n = Number(m[0]);
        const enabled = enabledComponents ?? [];

        if (Number.isFinite(n) && n >= 1 && n <= enabled.length) {
          return enabled[n - 1];
        }

        if (Number.isFinite(n) && n >= 1 && n <= availableComponents.length) {
          return availableComponents[n - 1];
        }
      }

      return "general";
    };

    for (const output of sortedOutputs as any[]) {
      // Primero buscar en asignaciones guardadas usando nameCell (ej: "E13")
      const nameCell = output?.nameCell || output?.name_cell;
      let component = "general";
      
      if (nameCell) {
        const assigned = getPromptComponent(nameCell);
        if (assigned !== "general") {
          component = assigned;
        } else {
          // Fallback: inferir por hoja
          component = inferComponentFromSheet(output?.sheet);
        }
      } else {
        component = inferComponentFromSheet(output?.sheet);
      }
      
      if (!grouped[component]) grouped[component] = [];
      grouped[component].push(output);
    }

    return grouped;
  }, [sortedOutputs, enabledComponents, getPromptComponent]);

  // Outputs generales (siempre visibles)
  const generalOutputs = useMemo(() => outputsByComponent.general || [], [outputsByComponent]);

  // Filtrar outputs de texto generales, EXCLUYENDO el price (se muestra aparte)
  const textOutputs = useMemo(() => {
    return generalOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      const type = String(o?.type || o?.outputType || "").toLowerCase();
      return !/^https?:\/\//i.test(value) && type !== "price";
    });
  }, [generalOutputs]);

  // Precio del API (productos simples): output type "Price" / "price"
  const apiPrice = useMemo(() => {
    const priceOutput = generalOutputs.find(
      (o: any) => String(o?.type || o?.outputType || "").toLowerCase() === "price"
    );

    if (!priceOutput) return 0;

    return (
      parseFloat(String(priceOutput.value ?? "0").replace(/\./g, "").replace(",", ".")) || 0
    );
  }, [generalOutputs]);

  // Calcular componentes activos según configuración
  const activeComponentsForPrice = useMemo(() => {
    if (boundProductConfig) {
      return getActiveComponents(boundProductConfig).filter((c) => c !== "general");
    }
    return enabledComponents;
  }, [boundProductConfig, enabledComponents]);

  // Calcular precio total sumando solo los componentes activos (productos compuestos)
  const calculatedTotalPrice = useMemo(() => {
    let total = 0;
    for (const comp of activeComponentsForPrice) {
      const compOutputs = outputsByComponent[comp] || [];
      const priceOutput = compOutputs.find(
        (o: any) => String(o?.type || o?.outputType || "").toLowerCase() === "price"
      );
      if (priceOutput) {
        const val =
          parseFloat(String(priceOutput.value ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
        total += val;
      }
    }
    return total;
  }, [outputsByComponent, activeComponentsForPrice]);

  const imageOutputs = useMemo(() => {
    return generalOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      return /^https?:\/\//i.test(value);
    });
  }, [generalOutputs]);

  // Outputs del componente seleccionado (sin repetir los generales)
  const selectedComponentOutputs = useMemo(() => {
    if (selectedComponent === "general") return [];
    return outputsByComponent[selectedComponent] || [];
  }, [outputsByComponent, selectedComponent]);

  const selectedTextOutputs = useMemo(() => {
    return selectedComponentOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      return !/^https?:\/\//i.test(value);
    });
  }, [selectedComponentOutputs]);

  const selectedImageOutputs = useMemo(() => {
    return selectedComponentOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      return /^https?:\/\//i.test(value);
    });
  }, [selectedComponentOutputs]);

  // Labels dinámicos según configuración seleccionada
  const dynamicComponentLabels = useMemo(() => {
    switch (boundProductConfig) {
      case "same_paper":
        return { general: "General", interior_1: "Contenido" };
      case "cover_1_interior":
        return { general: "General", cubierta: "Cubierta", interior_1: "Interior" };
      default:
        return { general: "General", cubierta: "Cubierta", interior_1: "Interior 1", interior_2: "Interior 2" };
    }
  }, [boundProductConfig]);

  const selectedProduct = products.find((p: any) => p.id === productId);

  // Check permissions - AFTER all hooks are called
  if (!isSuperAdmin && !isOrgAdmin) {
    return <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>Solo los administradores pueden acceder a esta página de prueba.</AlertDescription>
        </Alert>
      </div>;
  }
  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "0,00 €";
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(value);
  };
  const handlePromptChange = (id: string, value: any) => {
    // Solo actualiza el estado local, sin disparar API
    const key = String(id);
    setPromptValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  
  // Llamado cuando el usuario termina de editar (blur/enter o selección)
  const handlePromptCommit = (id: string, value: any) => {
    const key = String(id);

    // Track "cleared" prompts so we can omit them from the PATCH payload
    const isCleared = typeof value === "string" && value.trim() === "";
    setClearedPromptIds((prev) => {
      if (isCleared) return { ...prev, [key]: true };
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest as Record<string, true>;
    });

    // Clear any pending timeout to debounce rapid changes
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
    }

    // Debounce: wait 150ms before triggering API call (prevents rapid duplicate calls)
    commitTimeoutRef.current = setTimeout(() => {
      setHasUserModifiedPrompts(true);
      setDebouncedPromptValues((prev) => ({
        ...prev,
        [key]: value,
      }));
    }, 150);
  };
  const handleDiagnoseProduct = async () => {
    if (!productId) return;
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");
      const {
        data,
        error
      } = await supabase.functions.invoke("test-product-info", {
        body: {
          productId
        }
      });
      if (error) throw error;
      setDiagnosticResult(data);
    } catch (error: any) {
      console.error("Error al diagnosticar producto:", error);
      setDiagnosticResult({
        error: "Error al ejecutar diagnóstico",
        details: error.message
      });
    } finally {
      setIsDiagnosing(false);
    }
  };
  return <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/admin/productos?view=${viewMode}`} className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Volver a {viewMode === 'productos' ? 'Productos' : 'Componentes'}
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">
            {selectedProduct ? getProductLabel(selectedProduct) : `Prueba de ${viewMode}`}
          </h1>
        </div>
      </div>

      {/* Tabs: Productos / Componentes */}
      <div className="flex items-center gap-2">
        <Button 
          variant={viewMode === 'productos' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setViewMode('productos')}
          className="flex items-center gap-2"
        >
          <Package className="h-4 w-4" />
          Productos
        </Button>
        <Button 
          variant={viewMode === 'componentes' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setViewMode('componentes')}
          className="flex items-center gap-2"
        >
          <Boxes className="h-4 w-4" />
          Componentes
        </Button>
      </div>

      {isLoading ? <div className="text-center py-8">
          <p>Cargando {viewMode}...</p>
        </div> : <div className="grid lg:grid-cols-3 gap-6">
          {/* Product Selection & Configuration */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Selección de {viewMode === 'productos' ? 'producto' : 'componente'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Product Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{viewMode === 'productos' ? 'Producto' : 'Componente'}</label>
                  <div className="flex gap-2">
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={`Selecciona un ${viewMode === 'productos' ? 'producto' : 'componente'}...`} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product: any) => <SelectItem key={product.id} value={product.id}>
                            {getProductLabel(product)}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Selector de configuración - mostrar INMEDIATAMENTE cuando se selecciona producto */}
                {productId && needsConfigSelector && (
                  <BoundProductConfigSelector
                    enabledComponents={enabledComponents}
                    value={boundProductConfig}
                    onChange={setBoundProductConfig}
                  />
                )}

                {/* Product Configuration */}
                {productId && isLoadingProduct && <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cargando producto...</AlertTitle>
                    <AlertDescription>Obteniendo configuración del producto desde EasyQuote.</AlertDescription>
                  </Alert>}

                {productId && !isLoadingProduct && !productDetail && productLoadError && <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error al cargar el producto</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-sm">{productLoadError}</p>
                      <div className="flex gap-2">
                        <Button onClick={handleDiagnoseProduct} disabled={isDiagnosing} size="sm" variant="outline">
                          {isDiagnosing ? "Diagnosticando..." : "🔍 Diagnosticar"}
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>}

                {diagnosticResult && <Alert className={diagnosticResult.error ? "border-destructive" : "border-blue-500"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Resultado del Diagnóstico</AlertTitle>
                    <AlertDescription className="space-y-2">
                      {diagnosticResult.error ? <div className="space-y-2">
                          <p className="font-semibold">Error: {diagnosticResult.error}</p>
                          <p className="text-sm">Producto: {diagnosticResult.productName} (ID: {diagnosticResult.productId})</p>
                          <p className="text-sm">Estado HTTP: {diagnosticResult.status}</p>
                          
                          {diagnosticResult.diagnostics && <div className="mt-4 space-y-2">
                              <p className="font-semibold text-sm">Posibles causas:</p>
                              <ul className="list-disc list-inside text-sm space-y-1">
                                {diagnosticResult.diagnostics.suggestions?.map((suggestion: string, idx: number) => <li key={idx}>{suggestion}</li>)}
                              </ul>
                            </div>}
                          
                          {diagnosticResult.errorDetails && <details className="mt-3">
                              <summary className="cursor-pointer text-sm font-medium">Ver detalles técnicos</summary>
                              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                {JSON.stringify(diagnosticResult.errorDetails, null, 2)}
                              </pre>
                            </details>}
                        </div> : <div>
                          <p className="text-green-600 font-semibold">✅ El producto cargó correctamente</p>
                          <p className="text-sm mt-2">Prompts: {diagnosticResult.promptsCount}</p>
                          <p className="text-sm">Outputs: {diagnosticResult.outputsCount}</p>
                        </div>}
                    </AlertDescription>
                  </Alert>}

                {productId && !isLoadingProduct && productDetail && <div className="border-t pt-4 space-y-4">
                    
                    {/* Mostrar prompts solo si no requiere configuración O ya se seleccionó una */}
                    {(!needsConfigSelector || boundProductConfig) ? (
                      <>
                        <ComponentTabsPromptsForm 
                          product={productDetail} 
                          productId={productId} 
                          values={promptValues} 
                          onChange={handlePromptChange} 
                          onCommit={handlePromptCommit}
                          onComponentChange={setSelectedComponent}
                          boundProductConfig={boundProductConfig}
                          isAdmin={isSuperAdmin || isOrgAdmin}
                          onForceResultPrompts={setForceResultPrompts}
                        />

                        {/* Sección: Opciones restrictivas (prompts marcados como force_result) */}
                        {forceResultPrompts.length > 0 && (
                          <div className="border-t pt-4 mt-4">
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                              Opciones restrictivas
                            </h3>
                            <PromptsForm
                              product={{ prompts: forceResultPrompts }}
                              values={promptValues}
                              onChange={handlePromptChange}
                              onCommit={handlePromptCommit}
                              singleColumn
                            />
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>}
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div>
            {productId && <Card>
                <CardHeader>
                  <CardTitle>Resultados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Si requiere configuración y no se ha seleccionado, mostrar mensaje */}
                  {needsConfigSelector && !boundProductConfig && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Selecciona el tipo de producto para ver los resultados</p>
                    </div>
                  )}
                  
                  {/* Solo mostrar resultados si no requiere configuración O ya se seleccionó una */}
                  {(!needsConfigSelector || boundProductConfig) && (
                    <>
                      {pricingLoading && <div className="text-center py-8 text-muted-foreground">
                          <p>Calculando resultados...</p>
                        </div>}


                  {/* Precio (simple = API / compuesto = suma de componentes) + opción de modificar */}
                  {(() => {
                    const basePrice = isComposite ? calculatedTotalPrice : apiPrice;
                    if (!(basePrice > 0)) return null;

                    const title = isComposite ? "Precio Total" : "Precio";

                    return (
                      <div className="p-3 rounded-md border bg-accent/10 mb-4 space-y-3">
                        {/* Precio calculado */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            {modifiedPrice !== null ? "Precio calculado" : title}
                          </span>
                          <span
                            className={
                              modifiedPrice !== null
                                ? "text-sm text-muted-foreground line-through"
                                : "text-lg font-semibold"
                            }
                          >
                            {formatCurrency(basePrice)}
                          </span>
                        </div>

                        {/* Precio modificado (si existe) */}
                        {modifiedPrice !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Precio modificado</span>
                            <span className="text-lg font-semibold text-primary">{formatCurrency(modifiedPrice)}</span>
                          </div>
                        )}

                        {/* Campo de edición */}
                        {isEditingPrice && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Input
                              type="text"
                              value={localPriceInput}
                              onChange={(e) => setLocalPriceInput(e.target.value)}
                              placeholder="Nuevo precio"
                              className="flex-1"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const parsed =
                                  parseFloat(localPriceInput.replace(/\./g, "").replace(",", ".")) || 0;
                                setModifiedPrice(parsed > 0 ? parsed : null);
                                setIsEditingPrice(false);
                              }}
                            >
                              Aplicar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsEditingPrice(false);
                                setLocalPriceInput("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}

                        {/* Botón para activar edición - solo para admins */}
                        {!isEditingPrice && (isSuperAdmin || isOrgAdmin) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full text-xs"
                            onClick={() => {
                              const prefill = (modifiedPrice ?? basePrice).toFixed(2).replace(".", ",");
                              setLocalPriceInput(prefill);
                              setIsEditingPrice(true);
                            }}
                          >
                            {modifiedPrice !== null ? "Editar precio modificado" : "Modificar precio final"}
                          </Button>
                        )}

                        {/* Botón para quitar precio modificado - solo para admins */}
                        {modifiedPrice !== null && !isEditingPrice && (isSuperAdmin || isOrgAdmin) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full text-xs text-muted-foreground"
                            onClick={() => setModifiedPrice(null)}
                          >
                            Usar precio calculado
                          </Button>
                        )}
                      </div>
                    );
                  })()}


                  {/* Text outputs - General (sin precio) */}
                  {textOutputs.length > 0 && <div className="space-y-2 text-sm">
                      {textOutputs.map((output, index) => <div key={index} className="flex justify-between">
                          <span>{output.label || output.name}</span>
                          <span className="font-medium">{output.value}</span>
                        </div>)}
                    </div>}

                  {/* Image outputs - General */}
                  {imageOutputs.length > 0 && <div className="space-y-3 border-t pt-4">
                      {imageOutputs.map((output, index) => <div key={`${output.value}-${index}`} className="space-y-2">
                          <div className="text-sm font-medium">{output.label || output.name}</div>
                          <img key={output.value} src={output.value} alt={output.label || output.name || `Imagen ${index + 1}`} className="w-full max-w-md rounded border" />
                        </div>)}
                    </div>}

                  {/* Resultados del componente seleccionado */}
                  {selectedComponent !== "general" && (
                    <div className="border-t pt-4 mt-4 space-y-4">
                      <h4 className="font-semibold text-sm">{dynamicComponentLabels[selectedComponent] || COMPONENT_LABELS[selectedComponent] || selectedComponent}</h4>

                      {selectedTextOutputs.length === 0 && selectedImageOutputs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin resultados para este componente</p>
                      ) : (
                        <>
                          {selectedTextOutputs.length > 0 && (
                            <div className="space-y-2 text-sm">
                              {selectedTextOutputs.map((output, index) => (
                                <div key={`sel-${index}`} className="flex justify-between">
                                  <span>{output.label || output.name}</span>
                                  <span className="font-medium">{output.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {selectedImageOutputs.length > 0 && (
                            <div className="space-y-3 pt-2">
                              {selectedImageOutputs.map((output, index) => (
                                <div key={`sel-img-${output.value}-${index}`} className="space-y-2">
                                  <div className="text-sm font-medium">{output.label || output.name}</div>
                                  <img
                                    key={output.value}
                                    src={output.value}
                                    alt={output.label || output.name || `Imagen ${index + 1}`}
                                    className="w-full max-w-md rounded border"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                    </>
                  )}

                </CardContent>
              </Card>}
          </div>
        </div>}
    </div>;
}