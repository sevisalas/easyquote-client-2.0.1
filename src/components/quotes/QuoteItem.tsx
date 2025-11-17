import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [isExpanded, setIsExpanded] = useState<boolean>(shouldExpand || false);
  const [itemDescription, setItemDescription] = useState<string>("");
  const [isNewProduct, setIsNewProduct] = useState<boolean>(true);
  const [hasInitialOutputs, setHasInitialOutputs] = useState<boolean>(false);
  const [userHasChangedPrompts, setUserHasChangedPrompts] = useState<boolean>(false);
  const selectRef = useRef<HTMLButtonElement>(null);

  // Auto-expand/collapse based on shouldExpand prop
  useEffect(() => {
    if (shouldExpand !== undefined) {
      setIsExpanded(shouldExpand);
    }
  }, [shouldExpand, id]);

  // Multi-cantidades
  const [multiEnabled, setMultiEnabled] = useState<boolean>(false);
  const [qtyPrompt, setQtyPrompt] = useState<string>("");
  const [qtyInputs, setQtyInputs] = useState<string[]>(["", "", "", "", ""]);
  const MAX_QTY = 10;
  const [qtyCount, setQtyCount] = useState<number>(5);

  // Item additionals
  const [itemAdditionals, setItemAdditionals] = useState<any[]>([]);

  // Track changes for unsaved confirmation
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const initialStateRef = useRef<string>("");

  // Inicialización desde datos previos (duplicar)
  const initializedRef = useRef(false);
  
  // Reset initializedRef when id changes (new item or edit different item)
  useEffect(() => {
    initializedRef.current = false;
  }, [id]);
  
  // Log para debug - ver si initialData llega
  console.log('🔍 QuoteItem rendered with initialData:', initialData);
  
  useEffect(() => {
    console.log('🔍 useEffect executed - initializedRef:', initializedRef.current, 'initialData:', initialData);
    if (initializedRef.current) {
      console.log('⚠️ useEffect cancelled - already initialized');
      return;
    }
    if (!initialData) {
      console.log('⚠️ useEffect cancelled - no initialData');
      return;
    }
    initializedRef.current = true;
    try {
      console.log('✅ Starting initialization with initialData:', initialData);
      setProductId(initialData.productId || "");
      
      // Normalize prompts format: extract just the value if it's an object with {label, value, order}
      const normalizedPrompts: Record<string, any> = {};
      if (initialData.prompts) {
        console.log('🔍 Raw prompts:', initialData.prompts);
        Object.entries(initialData.prompts).forEach(([promptId, promptData]: [string, any]) => {
          // If it's an object with a value property, extract just the value
          if (promptData && typeof promptData === 'object' && 'value' in promptData) {
            normalizedPrompts[promptId] = promptData.value;
          } else {
            // Otherwise use the value as-is
            normalizedPrompts[promptId] = promptData;
          }
        });
        console.log('🔍 Normalized prompts:', normalizedPrompts);
      }
      
      setPromptValues(normalizedPrompts);
      setDebouncedPromptValues(normalizedPrompts); // También inicializar debounced para evitar re-fetch
      setItemDescription(initialData.itemDescription || "");
      
      // Si hay outputs guardados, marcar que no necesitamos fetchear
      if (initialData.outputs && Array.isArray(initialData.outputs) && initialData.outputs.length > 0) {
        console.log('✅ Initial outputs found:', initialData.outputs);
        setHasInitialOutputs(true);
        setIsNewProduct(false); // No es un producto "nuevo" si ya tiene datos guardados
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

  // Debounce promptValues changes - pero NO si es un producto nuevo (cargando valores iniciales)
  // IMPORTANTE: Incluir productId en dependencies para cancelar debounce al cambiar de producto
  useEffect(() => {
    if (isNewProduct) return; // No debounce si aún no hemos inicializado los valores por defecto
    const t = setTimeout(() => setDebouncedPromptValues(promptValues), 350);
    return () => clearTimeout(t);
  }, [promptValues, isNewProduct, productId]);

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

  // Sincronizar itemDescription con productName cuando está vacío
  useEffect(() => {
    if (productId && !itemDescription && products) {
      const selectedProduct = products.find((p: any) => String(p.id) === String(productId));
      if (selectedProduct) {
        setItemDescription(getProductLabel(selectedProduct));
      }
    }
  }, [productId, products, itemDescription]);

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

  const { data: pricing, error: pricingError, refetch: refetchPricing, isError: isPricingError } = useQuery({
    queryKey: ["easyquote-pricing", productId, debouncedPromptValues, forceRecalculate, isNewProduct, userHasChangedPrompts],
    // Permitir query si:
    // 1. Es producto nuevo Y no hay valores antiguos en debounce (carga inicial limpia)
    // 2. NO es producto nuevo (producto ya cargado, puede recibir updates)
    enabled: !!hasToken && !!productId && !hasInitialOutputs && 
             (isNewProduct ? Object.keys(debouncedPromptValues).length === 0 : true),
    retry: false, // No reintentar automáticamente para productos con error 500
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: forceRecalculate ? 0 : 5000,
    initialData: hasInitialOutputs && initialData ? { prompts: initialData.prompts, outputValues: initialData.outputs } : undefined, // Usar outputs guardados como initialData
    queryFn: async () => {
      const token = sessionStorage.getItem("easyquote_token");
      if (!token) throw new Error("Falta token de EasyQuote. Inicia sesión de nuevo.");
      
      console.log("🔥 Fetching pricing for product:", productId, "isNewProduct:", isNewProduct, "userHasChangedPrompts:", userHasChangedPrompts);

      // Si es producto nuevo O el usuario NO ha cambiado nada, NO enviar inputs
      const requestBody: any = {
        token,
        productId
      };

      // Solo incluir inputs si NO es un producto nuevo Y el usuario ha cambiado algo manualmente
      if (!isNewProduct && userHasChangedPrompts) {
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
        const inputsArray = Object.entries(norm).map(([id, value]) => ({ id, value }));
        if (inputsArray.length > 0) {
          requestBody.inputs = inputsArray;
        }
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
      
      // NO inicializar promptValues automáticamente
      // Los valores por defecto ya están en pricing.prompts[].currentValue
      // Solo se actualizará promptValues cuando el usuario cambie algo manualmente
      if (isNewProduct) {
        setIsNewProduct(false);
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

  // Track if prompts were initialized from saved data
  const previousProductIdRef = useRef<string>("");
  const hasMarkedAsLoadedRef = useRef<boolean>(false);
  
  // Reset ALL states when product changes - complete clean slate
  useEffect(() => {
    // Only reset if product actually changed (not initial load)
    if (previousProductIdRef.current && previousProductIdRef.current !== productId) {
      console.log("🔄 Producto cambió - RESET COMPLETO de todos los estados", { from: previousProductIdRef.current, to: productId });
      
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
      setUserHasChangedPrompts(false);
      setForceRecalculate(false);
      setHasUnsavedChanges(false);
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
    
    // Auto-expand when a product is selected for the first time
    if (productId && !isExpanded) {
      setIsExpanded(true);
    }
  }, [productId, products]);

  // Auto-expand when component mounts without a product
  useEffect(() => {
    if (!productId) {
      setIsExpanded(true);
    }
  }, []);

  // Derive prompts and outputs
  const outputs = useMemo(() => ((pricing as any)?.outputValues ?? []) as any[], [pricing]);
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
  }, [priceOutput, itemAdditionals, multiEnabled, multiRows]);

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

  // Initialize all prompts when pricing data loads
  useEffect(() => {
    if (pricing && productId) {
      const allPrompts = extractAllPrompts(pricing);
      
      // Merge with existing prompts (preserve user changes)
      setPromptValues((prev) => {
        const merged = { ...allPrompts };
        
        // Keep user-modified values
        Object.entries(prev).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            merged[key] = value;
          }
        });
        
        return merged;
      });
      
      // Mark product as loaded after prompts are initialized
      if (isNewProduct) {
        console.log("✅ Producto cargado exitosamente, marcando como no nuevo");
        setIsNewProduct(false);
      }
    }
  }, [pricing, productId, isNewProduct]);

  const handlePromptChange = (id: string, value: any, label: string) => {
    console.log("🔄 Usuario cambió prompt manualmente:", { id, value, label });
    setUserHasChangedPrompts(true); // Marcar que el usuario ha hecho cambios manuales
    
    setPromptValues((prev) => {
      // Preserve the order field if it exists, or find it from product definition
      let order = prev[id]?.order;
      
      // If no order exists, try to get it from the product pricing prompts using promptSequence
      if (order === undefined && pricing) {
        const prompts = (pricing as any)?.prompts || [];
        const promptDef = prompts.find((p: any) => String(p.id) === String(id));
        if (promptDef) {
          // Usar promptSequence de EasyQuote API
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

  const selectedProductInfo = products?.find((p: any) => String(p.id) === String(productId));
  const productName = selectedProductInfo ? getProductLabel(selectedProductInfo) : "";

  // Filter visible prompts based on product configuration
  const visiblePrompts = useMemo(() => {
    if (!pricing) return promptValues;
    
    const allPrompts = extractPrompts(pricing);
    const effectiveValues: Record<string, any> = {};
    
    // Extract actual values from promptValues
    Object.entries(promptValues).forEach(([key, val]) => {
      effectiveValues[key] = (val && typeof val === 'object' && 'value' in val) ? val.value : val;
    });
    
    // Filter to only include visible prompts
    const visiblePromptIds = new Set(
      allPrompts.filter(p => isVisiblePrompt(p, effectiveValues)).map(p => p.id)
    );
    
    const filtered: Record<string, any> = {};
    Object.entries(promptValues).forEach(([key, value]) => {
      if (visiblePromptIds.has(key)) {
        filtered[key] = value;
      }
    });
    
    return filtered;
  }, [pricing, promptValues]);

  // Sync with parent (without adding additionals to product name)
  useEffect(() => {
    onChange?.(id, {
      productId,
      prompts: visiblePrompts, // Use filtered prompts
      outputs,
      price: finalPrice,
      multi: multiEnabled ? { qtyPrompt, qtyInputs, rows: multiRows } : null,
      itemDescription: itemDescription || productName,
      itemAdditionals,
      isFinalized: initialData?.isFinalized, // Preserve isFinalized state
    });
  }, [id, onChange, productId, visiblePrompts, outputs, finalPrice, multiEnabled, qtyPrompt, qtyInputs, multiRows, itemDescription, productName, itemAdditionals, initialData?.isFinalized]);

  const isComplete = productId && priceOutput && finalPrice > 0;

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
                onClick={() => setIsExpanded(true)}
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
                  if (onFinishEdit) {
                    onFinishEdit(id);
                  }
                }}
                size="sm" 
                variant="default"
                disabled={!isComplete}
                className="whitespace-nowrap bg-primary hover:bg-primary/90"
              >
                Finalizar producto
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
                onClick={() => setIsExpanded(false)}
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
                setProductId(value);
                // Establecer automáticamente el itemDescription con el nombre del producto
                const selectedProduct = products?.find((p: any) => String(p.id) === String(value));
                if (selectedProduct) {
                  setItemDescription(getProductLabel(selectedProduct));
                }
              }} value={productId} disabled={!hasToken}>
                <SelectTrigger ref={selectRef}>
                  <SelectValue placeholder={hasToken ? "Elige un producto" : "Conecta EasyQuote para cargar"} />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{getProductLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productId && (
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
              <CardTitle>Opciones</CardTitle>
            </CardHeader>
            <CardContent>
              {isPricingError && pricingError ? (
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
                <PromptsForm product={pricing} values={promptValues} onChange={handlePromptChange} />
              ) : (
                <p className="text-sm text-muted-foreground">Cargando prompts…</p>
              )}
            </CardContent>
          </Card>

          <div className="md:col-span-2 md:sticky md:top-6 self-start space-y-3">
            {isPricingError && pricingError && (
              <Alert variant="destructive">
                <AlertTitle>Producto no disponible</AlertTitle>
                <AlertDescription>
                  Este producto no puede ser usado actualmente. Selecciona otro de la lista.
                </AlertDescription>
              </Alert>
            )}
            {imageOutputs.length > 0 && (
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
              </CardContent>
            </Card>

            {!hideMultiQuantities && (
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
