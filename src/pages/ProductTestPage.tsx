import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeEasyQuoteFunction, getEasyQuoteToken } from "@/lib/easyquoteApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import PromptsForm from "@/components/quotes/PromptsForm";
import ComponentTabsPromptsForm, { COMPONENT_LABELS } from "@/components/quotes/ComponentTabsPromptsForm";
import { useProductComponentSettings } from "@/hooks/useProductComponentSettings";
import { ArrowLeft, AlertCircle } from "lucide-react";
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
  const [productDetail, setProductDetail] = useState<any>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasUserModifiedPrompts, setHasUserModifiedPrompts] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string>('general');
  const [tokenReady, setTokenReady] = useState(!!sessionStorage.getItem("easyquote_token"));
  const {
    isSuperAdmin,
    isOrgAdmin,
    organization,
    membership
  } = useSubscription();
  
  // Check if product is composite
  const { isComposite } = useProductComponentSettings(productId || undefined);
  const queryClient = useQueryClient();
  
  const organizationId = organization?.id || membership?.organization_id;

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

  // Fetch products - with aggressive caching (separate key to avoid conflicts)
  const {
    data: products = [],
    isLoading
  } = useQuery({
    queryKey: ["easyquote-products-test-page"],
    queryFn: fetchProducts,
    enabled: tokenReady,
    staleTime: 10 * 60 * 1000,
    // 10 minutes - products rarely change
    gcTime: 30 * 60 * 1000 // 30 minutes cache
  });

  // Fetch product detail when productId changes
  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!productId) {
        console.log("🔴 No productId selected");
        setProductDetail(null);
        setIsLoadingProduct(false);
        return;
      }
      
      // SKIP if we already have this product loaded
      if (productDetail?.productId === productId || productDetail?.id === productId) {
        console.log("⏭️ Product already loaded, skipping fetch:", productId);
        return;
      }
      
      console.log("🟢 Starting to fetch product detail for:", productId);
      setIsLoadingProduct(true);
      setIsInitialLoad(true);
      setHasUserModifiedPrompts(false);
      setDiagnosticResult(null);
      
      // Use getEasyQuoteToken which validates and auto-refreshes expired tokens
      const token = await getEasyQuoteToken();
      if (!token) {
        console.error("🔴 No EasyQuote token available");
        setIsLoadingProduct(false);
        return;
      }
      console.log("✅ EasyQuote token obtained");
      try {
        // Get product details
        const selectedProduct = products.find((p: any) => p.id === productId);
        if (!selectedProduct) {
          console.error("🔴 Product not found in products list:", productId);
          return;
        }
        console.log("✅ Selected product:", selectedProduct.productName || selectedProduct.name);

        // Get pricing data (which includes prompts)
        console.log("📡 Calling easyquote-pricing...");
        const {
          data: pricingData,
          error: pricingError
        } = await invokeEasyQuoteFunction("easyquote-pricing", {
          token,
          productId: productId,
          inputs: []
        });
        if (pricingError) {
          console.error("🔴 Pricing error:", pricingError);
          throw pricingError;
        }
        console.log("✅ Pricing data received:", pricingData);
        console.log("📋 Prompts from pricing:", pricingData?.prompts?.length || 0);
        setProductDetail(pricingData);

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

        // Mark initial load as complete after a brief delay to prevent immediate refetch
        setTimeout(() => {
          console.log("✅ Initial load complete");
          setIsInitialLoad(false);
        }, 300); // Reduced from 1000ms
      } catch (error) {
        console.error("🔴 Error fetching product detail:", error);
        setProductDetail(null);
        setPromptValues({});
        setIsInitialLoad(false);
      } finally {
        setIsLoadingProduct(false);
      }
    };
    fetchProductDetail();
  }, [productId, products, productDetail?.productId, productDetail?.id]);

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
      const allPromptValues: Record<string, any> = {};

      // First, collect all current values from the product prompts
      (productDetail?.prompts || []).forEach((p: any) => {
        if (p.currentValue !== undefined && p.currentValue !== null) {
          allPromptValues[p.id] = p.currentValue;
        }
      });

      // Override with user-modified values
      Object.entries(debouncedPromptValues || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          allPromptValues[k] = v;
        }
      });
      console.log("All prompt values (merged):", allPromptValues);

      // Now normalize all values for the API
      const norm: Record<string, any> = {};
      Object.entries(allPromptValues).forEach(([k, v]) => {
        if (v === "" || v === undefined || v === null) return;

        // Find the prompt to check its type
        const prompt = productDetail?.prompts?.find((p: any) => p.id === k);
        const promptType = prompt?.promptType;
        if (typeof v === "string") {
          const trimmed = v.trim();

          // Skip empty strings
          if (trimmed === "") return;

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
      if (error) throw error;
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

    // 3) Fallback: asignación por tipo (cuando no hay id/idx en pricing)
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
        const def = defByOriginalIndex.get(idxRaw) ?? defByOriginalIndex.get(idxRaw - 1);
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

      // 2.5) Fallback MUY fiable: respetar el orden del array devuelto por pricing
      const posRaw = Number(o?.__pos);
      if (Number.isFinite(posRaw)) {
        const def = defByOriginalIndex.get(posRaw);
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

  // Order outputs por rangos: 1) Price, 2) Quantity, 3) Instructions, 4) Workflow, 5) Generic, 6) resto.
  // Dentro de cada rango: por hoja + nameCell (A1, B2, ...). Si no hay celda, por label.
  const sortedOutputs = useMemo(() => {
    // Si hay orden guardado, usarlo como prioridad principal
    if (savedOutputOrder && savedOutputOrder.length > 0) {
      const normalizeKey = (v: any) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
      const orderMap = new Map(savedOutputOrder.map((k: string, idx: number) => [normalizeKey(k), idx]));

      return [...allOutputs].sort((a: any, b: any) => {
        const aKey = normalizeKey(a?.nameCell || a?.name || a?.label || "");
        const bKey = normalizeKey(b?.nameCell || b?.name || b?.label || "");
        const aIdx = aKey && orderMap.has(aKey) ? orderMap.get(aKey)! : 999;
        const bIdx = bKey && orderMap.has(bKey) ? orderMap.get(bKey)! : 999;
        return aIdx - bIdx;
      });
    }

    // Fallback: ordenar por tipo y celda si no hay orden guardado
    const typePriority: Record<string, number> = {
      price: 1,
      quantity: 2,
      instructions: 3,
      intrucctions: 3,
      workflow: 4,
      generic: 5,
    };

    const normalizeType = (o: any) =>
      String(o?.outputType ?? o?.type ?? "")
        .trim()
        .toLowerCase();

    const normalizeSheet = (o: any) => String(o?.sheet ?? "").trim().toUpperCase();

    const normalizeCell = (v: any) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

    const parseCell = (cellRaw: string) => {
      const cell = normalizeCell(cellRaw);
      const m = cell.match(/^([A-Z]+)(\d+)$/);
      if (!m) return null;
      const [, letters, rowStr] = m;
      const row = Number(rowStr);
      const col = letters.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
      if (!Number.isFinite(row) || row <= 0 || col <= 0) return null;
      return { col, row };
    };

    return allOutputs
      .map((o, index) => {
        const type = normalizeType(o);
        const priority = typePriority[type] ?? 999;
        const sheetKey = normalizeSheet(o);
        const nameCellKey = normalizeCell(o?.nameCell);
        const parsed = nameCellKey ? parseCell(nameCellKey) : null;
        const labelKey = String(o?.label ?? o?.name ?? "").trim().toUpperCase();
        return { o, index, priority, sheetKey, nameCellKey, parsed, labelKey };
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.sheetKey !== b.sheetKey) return a.sheetKey.localeCompare(b.sheetKey);
        const aHas = !!a.parsed;
        const bHas = !!b.parsed;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (a.parsed && b.parsed) {
          if (a.parsed.col !== b.parsed.col) return a.parsed.col - b.parsed.col;
          if (a.parsed.row !== b.parsed.row) return a.parsed.row - b.parsed.row;
        }
        if (a.labelKey !== b.labelKey) return a.labelKey.localeCompare(b.labelKey);
        return a.index - b.index;
      })
      .map((x) => x.o);
  }, [allOutputs, savedOutputOrder]);

  // Agrupar outputs por componente basado en la hoja (sheet)
  const outputsByComponent = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    // Mapear hojas a componentes por nombre de hoja
    const sheetNameToComponent: Record<string, string> = {
      'cubierta': 'cubierta',
      'cover': 'cubierta', 
      'interior': 'interior_1',
      'interior 1': 'interior_1',
      'interior_1': 'interior_1',
      'interior1': 'interior_1',
      'interior 2': 'interior_2',
      'interior_2': 'interior_2',
      'interior2': 'interior_2',
    };
    
    sortedOutputs.forEach((output: any) => {
      const sheetRaw = String(output?.sheet ?? '').toLowerCase().trim();
      let component = 'general';
      
      // Intentar mapear por nombre de hoja
      if (sheetNameToComponent[sheetRaw]) {
        component = sheetNameToComponent[sheetRaw];
      } else if (sheetRaw && sheetRaw !== '1' && sheetRaw !== '') {
        // Si tiene un nombre de hoja que no conocemos, usarlo como componente
        component = sheetRaw;
      }
      
      if (!grouped[component]) {
        grouped[component] = [];
      }
      grouped[component].push(output);
    });
    
    return grouped;
  }, [sortedOutputs]);

  // Todos los outputs (para la vista principal)
  const textOutputs = useMemo(() => {
    return sortedOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      return !/^https?:\/\//i.test(value);
    });
  }, [sortedOutputs]);

  const imageOutputs = useMemo(() => {
    return sortedOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      return /^https?:\/\//i.test(value);
    });
  }, [sortedOutputs]);

  // Outputs específicos del componente seleccionado (excluyendo general)
  const selectedComponentOutputs = useMemo(() => {
    if (selectedComponent === 'general') return [];
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
    setPromptValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Llamado cuando el usuario termina de editar (blur/enter o selección)
  const handlePromptCommit = (id: string, value: any) => {
    setHasUserModifiedPrompts(true);
    // El valor ya está en promptValues, solo marcamos que hay cambios
    setDebouncedPromptValues(prev => ({
      ...prev,
      [id]: value
    }));
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
              <Link to="/admin/productos" className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Volver a Productos
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">
            {selectedProduct ? getProductLabel(selectedProduct) : "Prueba de productos"}
          </h1>
        </div>
      </div>

      {isLoading ? <div className="text-center py-8">
          <p>Cargando productos...</p>
        </div> : <div className="grid lg:grid-cols-3 gap-6">
          {/* Product Selection & Configuration */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Selección de producto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Product Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Producto</label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un producto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product: any) => <SelectItem key={product.id} value={product.id}>
                          {getProductLabel(product)}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Configuration */}
                {productId && isLoadingProduct && <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cargando producto...</AlertTitle>
                    <AlertDescription>Obteniendo configuración del producto desde EasyQuote.</AlertDescription>
                  </Alert>}

                {productId && !isLoadingProduct && !productDetail && <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error al cargar el producto</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>El servidor de EasyQuote devolvió un error 500. Esto indica un problema de configuración en EasyQuote.</p>
                      <Button onClick={handleDiagnoseProduct} disabled={isDiagnosing} size="sm" variant="outline">
                        {isDiagnosing ? "Diagnosticando..." : "🔍 Diagnosticar Producto"}
                      </Button>
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

                {productId && !isLoadingProduct && productDetail && <div className="border-t pt-4">
                    <ComponentTabsPromptsForm 
                      product={productDetail} 
                      productId={productId} 
                      values={promptValues} 
                      onChange={handlePromptChange} 
                      onCommit={handlePromptCommit}
                      onComponentChange={setSelectedComponent}
                    />
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
                  {pricingLoading && <div className="text-center py-8 text-muted-foreground">
                      <p>Calculando resultados...</p>
                    </div>}

                  {!pricingLoading && !pricing && !isLoadingProduct && productDetail && textOutputs.length === 0 && <div className="text-center py-8 text-muted-foreground">
                      <p>Configura los parámetros para ver los resultados</p>
                    </div>}

                  {!pricingLoading && pricing && textOutputs.length === 0 && imageOutputs.length === 0 && selectedTextOutputs.length === 0 && selectedImageOutputs.length === 0 && <div className="text-center py-8 text-muted-foreground">
                      <p>No hay resultados disponibles para esta configuración</p>
                    </div>}

                  {/* Text outputs - General */}
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

                  {/* Outputs del componente seleccionado */}
                  {selectedComponent !== 'general' && (selectedTextOutputs.length > 0 || selectedImageOutputs.length > 0) && (
                    <div className="border-t pt-4 mt-4 space-y-4">
                      <h4 className="font-semibold text-sm">{COMPONENT_LABELS[selectedComponent] || selectedComponent}</h4>
                      
                      {selectedTextOutputs.length > 0 && <div className="space-y-2 text-sm">
                          {selectedTextOutputs.map((output, index) => <div key={`sel-${index}`} className="flex justify-between">
                              <span>{output.label || output.name}</span>
                              <span className="font-medium">{output.value}</span>
                            </div>)}
                        </div>}

                      {selectedImageOutputs.length > 0 && <div className="space-y-3 pt-2">
                          {selectedImageOutputs.map((output, index) => <div key={`sel-img-${output.value}-${index}`} className="space-y-2">
                              <div className="text-sm font-medium">{output.label || output.name}</div>
                              <img key={output.value} src={output.value} alt={output.label || output.name || `Imagen ${index + 1}`} className="w-full max-w-md rounded border" />
                            </div>)}
                        </div>}
                    </div>
                  )}

                </CardContent>
              </Card>}
          </div>
        </div>}
    </div>;
}