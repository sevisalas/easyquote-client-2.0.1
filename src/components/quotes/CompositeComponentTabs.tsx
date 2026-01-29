import { useMemo, useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActiveComponent, getActiveComponentKey } from "./CompositeComponentsSelector";
import { useQuery, useQueries } from "@tanstack/react-query";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import PromptsForm, { type PromptDef, extractPrompts } from "./PromptsForm";
import { supabase } from "@/integrations/supabase/client";
import { useProductPromptSettings } from "@/hooks/useProductPromptSettings";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface CompositeComponentTabsProps {
  /** Producto padre compuesto */
  parentProductId: string;
  /** organization_id (recomendado para RLS multi-tenant) */
  organizationId?: string;
  /** Componentes activos seleccionados por el usuario */
  activeComponents: ActiveComponent[];
  /** Valores de prompts del producto padre */
  parentPromptValues: Record<string, any>;
  /** Callback cuando cambian los prompts del padre */
  onParentPromptChange: (id: string, value: any, label?: string) => void;
  /** Callback cuando se confirma un prompt del padre */
  onParentPromptCommit?: (id: string, value: any, label?: string) => void;
  /** Producto detail del padre (para prompts) */
  parentProduct: any;
  /** Map de product_id -> nombre del producto */
  productNames?: Map<string, string>;
  /** Es admin (muestra todos los prompts) */
  isAdmin?: boolean;
  /** Callback para cambio de componente seleccionado */
  onComponentChange?: (componentId: string) => void;
  /** Callback para exponer los datos calculados de componentes (para el panel de resultados) */
  onComponentsDataChange?: (data: ComponentsDataMap, totalPrice: number, parentOutputs?: any[]) => void;
  /** Valores de prompts editados por el usuario para cada componente: { [componentId]: { [promptId]: value } } */
  componentPromptValues?: Record<string, Record<string, any>>;
  /** Callback cuando cambian los prompts de un componente */
  onComponentPromptChange?: (componentId: string, promptId: string, value: any) => void;
  /** Callback cuando se confirma un prompt de componente */
  onComponentPromptCommit?: (componentId: string, promptId: string, value: any) => void;
}

export interface ComponentPricingData {
  prompts: any[];
  outputs: any[];
  price: number;
  isLoading: boolean;
  alias: string;
}

export type ComponentsDataMap = Record<string, ComponentPricingData>;

/**
 * Layout de productos compuestos:
 * - IZQUIERDA: Prompts del producto padre (generales)
 * - DERECHA: Prompts del componente seleccionado (tabs para cambiar componente)
 * 
 * Los prompts heredados se muestran en el padre; en el componente se ven
 * los prompts NO mapeados (editables por usuario) + los mapeados como readonly.
 */
export default function CompositeComponentTabs({
  parentProductId,
  organizationId: organizationIdProp,
  activeComponents,
  parentPromptValues,
  onParentPromptChange,
  onParentPromptCommit,
  parentProduct,
  productNames = new Map(),
  isAdmin = false,
  onComponentChange,
  onComponentsDataChange,
  componentPromptValues = {},
  onComponentPromptChange,
  onComponentPromptCommit,
}: CompositeComponentTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("");

  // Prompts del padre normalizados (para lookup de valores actuales aunque parentPromptValues esté vacío)
  const parentPromptsForLookup = useMemo(() => extractPrompts(parentProduct), [parentProduct]);

  // Mapa: parentPromptId -> valor actual (currentValue/default)
  const parentPromptValueById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of parentPromptsForLookup) {
      const id = String((p as any)?.id ?? "").trim();
      if (!id) continue;
      const v = (p as any)?.currentValue ?? (p as any)?.default ?? (p as any)?.default_value;
      if (v !== undefined) map.set(id, v);
    }
    return map;
  }, [parentPromptsForLookup]);

  const getEffectiveParentPromptValue = useCallback(
    (sourcePromptName: string) => {
      const key = String(sourcePromptName ?? "").trim();
      const fromState = parentPromptValues[key];
      if (fromState !== undefined && fromState !== null) return fromState;
      const fromProduct = parentPromptValueById.get(key);
      if (fromProduct !== undefined && fromProduct !== null) return fromProduct;
      return undefined;
    },
    [parentPromptValues, parentPromptValueById]
  );

  // Igual que en PromptsForm: no “commit” mientras se escribe; Enter hace blur y el blur comitea.
  const handleEnterToBlur = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }, []);

  // Hook para obtener configuración de prompts (force_result, admin_only, is_hidden, etc.)
  const { isPromptForceResult, isPromptHidden, organizationId: settingsOrganizationId } = useProductPromptSettings(parentProductId);

  // organization_id efectivo (necesario para RLS en tablas multi-tenant)
  const organizationId = organizationIdProp ?? settingsOrganizationId;

  // Necesitamos las definiciones de prompts para mapear UUID -> celda (B10, B36, etc.)
  // y así poder aplicar correctamente force_result (se guarda en BD por celda).
  const { data: parentPromptDefinitions = [] } = useQuery({
    queryKey: ["easyquote-prompts-definitions", parentProductId],
    queryFn: async () => {
      if (!parentProductId) return [];
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const { data, error } = await invokeEasyQuoteFunction<any[]>("easyquote-prompts", {
        token,
        productId: parentProductId,
      });
      if (error) {
        console.error("[CompositeComponentTabs] Error fetching parent prompt definitions", error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!parentProductId,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch prompt connections from database
  const {
    data: promptConnections = [],
    isSuccess: promptConnectionsReady,
  } = useQuery({
    queryKey: ["composite-prompt-connections", parentProductId, organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("composite_prompt_connections")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("composite_product_id", parentProductId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!parentProductId && !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch output aggregation config from database
  const { data: outputAggregations = [] } = useQuery({
    queryKey: ["composite-output-aggregations", parentProductId, organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("composite_output_aggregations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("composite_product_id", parentProductId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!parentProductId && !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  function getPromptCell(op: any): string | undefined {
    return op?.promptCell ?? op?.prompt_cell ?? op?.cell ?? op?.promptcell;
  }

  // Normalizar nombre de prompt para comparación
  const normalizePromptName = (v: any) => String(v ?? "").replace(/\$/g, "").trim().toUpperCase();

  // Extraer celda (B10) de un string. Ojo: evitamos matches "dentro" de UUIDs usando \b.
  const extractCellRef = (v: any): string | null => {
    const s = String(v ?? "").replace(/\$/g, "").toUpperCase();
    const m = s.match(/\b[A-Z]{1,3}\d{1,4}\b/);
    return m?.[0] ?? null;
  };

  // Normaliza el tipo de prompt (viene como promptType en EasyQuote: DropDown, Number, TextBox, Checkbox, etc.)
  const getPromptTypeKey = (p: any) => String(p?.type ?? p?.promptType ?? "").trim().toLowerCase();

  const normalizeValueOptions = (p: any) => {
    const rawOptions =
      p?.valueOptions ??
      p?.value_options ??
      p?.options ??
      p?.values ??
      p?.items ??
      [];
    const arr = Array.isArray(rawOptions) ? rawOptions : [];
    return arr
      .map((o: any) => {
        if (typeof o === "string" || typeof o === "number") {
          return { label: String(o), value: String(o) };
        }
        const value = o?.value ?? o?.id ?? o?.key ?? o?.name;
        const label = o?.label ?? o?.title ?? o?.name ?? value;
        if (value === undefined || value === null) return null;
        return { label: String(label ?? value), value: String(value) };
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;
  };

  // Lookup: UUID -> celda (ej: "B10") para el producto padre.
  const parentPromptCellLookup = useMemo(() => {
    const map = new Map<string, string>();

    for (const p of parentPromptDefinitions as any[]) {
      const rawCell = getPromptCell(p);
      const cell = extractCellRef(rawCell) ?? normalizePromptName(rawCell);
      if (!cell) continue;

      const uuid = String(p?.id ?? "").trim();
      if (uuid) {
        map.set(uuid, cell);
        map.set(uuid.toUpperCase(), cell);
        map.set(uuid.toLowerCase(), cell);
      }

      const keys = [p?.key, p?.code, p?.slug, p?.name, getPromptCell(p)];
      for (const k of keys) {
        const kn = extractCellRef(k) ?? normalizePromptName(k);
        if (kn) map.set(kn, cell);
      }

      map.set(cell, cell);
    }

    return map;
  }, [parentPromptDefinitions]);

  const getParentPromptAdminKey = useCallback((prompt: PromptDef): string => {
    const idStr = String(prompt.id).trim();

    // 1) UUID -> celda (clave más fiable)
    const cellFromUuid = parentPromptCellLookup.get(idStr);
    if (cellFromUuid) return cellFromUuid;

    // 2) fallback por celdas detectables
    const idNorm = extractCellRef(idStr) ?? normalizePromptName(idStr);
    const labelCell = extractCellRef((prompt as any)?.label);

    const cellFromId = idNorm ? parentPromptCellLookup.get(idNorm) : undefined;
    const cellFromLabel = labelCell ? (parentPromptCellLookup.get(labelCell) ?? labelCell) : undefined;

    return cellFromId ?? cellFromLabel ?? extractCellRef(idStr) ?? labelCell ?? idNorm ?? idStr;
  }, [parentPromptCellLookup]);

  // Separar prompts del padre en regulares y force_result (filtrando ocultos)
  const { parentRegularPrompts, parentForceResultPrompts } = useMemo(() => {
    const allPrompts = extractPrompts(parentProduct);
    const regular: PromptDef[] = [];
    const forceResult: PromptDef[] = [];

    for (const prompt of allPrompts) {
      const key = getParentPromptAdminKey(prompt);
      // Filtrar prompts ocultos (is_hidden)
      if (isPromptHidden(key)) continue;
      
      if (isPromptForceResult(key)) forceResult.push(prompt);
      else regular.push(prompt);
    }

    return { parentRegularPrompts: regular, parentForceResultPrompts: forceResult };
  }, [parentProduct, isPromptForceResult, isPromptHidden, getParentPromptAdminKey]);

  // Producto virtual para prompts regulares del padre
  const parentRegularProduct = useMemo(() => {
    return { prompts: parentRegularPrompts };
  }, [parentRegularPrompts]);

  // Inputs efectivos del padre (estado + currentValue). Esto evita depender de que el estado
  // esté “poblado” para poder calcular componentes en la página de test.
  const parentInputs = useMemo(() => {
    const inputs: { id: string; value: any }[] = [];
    for (const p of parentPromptsForLookup) {
      const id = String((p as any)?.id ?? "").trim();
      if (!id) continue;

      const value = parentPromptValues[id] ?? (p as any)?.currentValue;
      if (value === undefined || value === null) continue;

      const actualValue =
        typeof value === "object" && value !== null && "value" in (value as any)
          ? (value as any).value
          : value;

      if (actualValue !== undefined && actualValue !== null) {
        inputs.push({ id, value: actualValue });
      }
    }
    return inputs;
  }, [parentPromptsForLookup, parentPromptValues]);

  // Verificar si hay valores de prompts padre disponibles
  const hasParentValues = parentInputs.length > 0;

  // Query para obtener outputs del producto PADRE (ancho, alto, etc.)
  const { data: parentPricingData } = useQuery({
    queryKey: ["parent-pricing-outputs", parentProductId, JSON.stringify(parentPromptValues)],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) throw new Error("No hay token");

      console.log("[CompositeComponentTabs] Fetching parent outputs", {
        parentProductId,
        inputsCount: parentInputs.length,
      });

      const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
        token,
        productId: parentProductId,
        inputs: parentInputs,
        productType: "composite",
      });

      if (error) throw error;
      
      return {
        outputs: data?.outputValues || data?.outputs || [],
        prompts: data?.prompts || [],
      };
    },
    enabled: !!parentProductId && hasParentValues,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Outputs del padre (generales)
  const parentOutputs = useMemo(() => parentPricingData?.outputs || [], [parentPricingData]);

  // Usar useQueries para obtener datos de todos los componentes
  // Incluye tanto los valores heredados (conexiones) como los editados por el usuario (componentPromptValues)
  // IMPORTANTE: Usamos getActiveComponentKey para distinguir múltiples instancias del mismo componente
  const componentQueriesResults = useQueries({
    queries: activeComponents.map((component) => {
      const componentKey = getActiveComponentKey(component);
      // Obtener valores editados por el usuario para esta instancia específica
      const userEditedValues = componentPromptValues[componentKey] || {};
      
      return {
        queryKey: [
          "component-pricing", 
          component.component_product_id, 
          componentKey, // Usar key única que incluye instance_index
          JSON.stringify(parentPromptValues),
          JSON.stringify(userEditedValues), // Incluir valores editados en la key
        ],
        queryFn: async (): Promise<{ prompts: any[]; outputs: any[]; price: number }> => {
          const token = await getEasyQuoteToken();
          if (!token) throw new Error("No hay token");

          // Calcular valores de prompts para este componente basado en las conexiones
          const componentInputs: { id: string; value: any }[] = [];
          
          // Filtrar conexiones para ESTE componente (por id O por component_product_id)
          const connections = promptConnections.filter(
            (conn: any) => 
              conn.target_component_id === component.id || 
              conn.target_component_id === component.component_product_id
          );

          // 1. Añadir valores heredados de conexiones
          for (const conn of connections as any[]) {
            let sourceValue = getEffectiveParentPromptValue(conn.source_prompt_name);
            
            // El valor puede venir como objeto {value, label} o como primitivo
            if (sourceValue !== undefined && sourceValue !== null) {
              // Extraer el valor real si es un objeto
              const actualValue = (typeof sourceValue === 'object' && sourceValue !== null && 'value' in sourceValue)
                ? sourceValue.value
                : sourceValue;
              
              if (actualValue !== undefined && actualValue !== null) {
                componentInputs.push({
                  id: conn.target_prompt_name,
                  value: actualValue,
                });
              }
            }
          }
          
          // 2. Añadir valores editados por el usuario (sobrescriben si hay conflicto)
          for (const [promptId, value] of Object.entries(userEditedValues)) {
            if (value !== undefined && value !== null) {
              // Buscar si ya existe en componentInputs y sobrescribir
              const existingIdx = componentInputs.findIndex(i => i.id === promptId);
              if (existingIdx >= 0) {
                componentInputs[existingIdx].value = value;
              } else {
                componentInputs.push({ id: promptId, value });
              }
            }
          }
          
          console.log("[CompositeComponentTabs] API inputs for component instance", {
            componentKey,
            componentProductId: component.component_product_id,
            instanceIndex: component.instance_index,
            connectionsFound: connections.length,
            userEditedValuesCount: Object.keys(userEditedValues).length,
            inputs: componentInputs,
          });

          const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
            token,
            productId: component.component_product_id,
            inputs: componentInputs,
            productType: "composite",
            componentId: componentKey,
          });

          if (error) throw error;
          
          const prompts = data?.prompts || [];
          const outputs = data?.outputValues || data?.outputs || [];
          
          const priceOutput = outputs.find(
            (o: any) => String(o?.type || o?.outputType || "").toLowerCase() === "price"
          );
          const price = priceOutput
            ? parseFloat(String(priceOutput.value ?? "0").replace(/\./g, "").replace(",", ".")) || 0
            : 0;
            
          return { prompts, outputs, price };
        },
        // Solo ejecutar cuando tenemos valores del padre Y las conexiones están cargadas
        enabled: !!component.component_product_id && hasParentValues && promptConnectionsReady,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
      };
    }),
  });

  // Query para obtener el orden de outputs guardado para CADA componente
  const componentOutputOrderQueries = useQueries({
    queries: activeComponents.map((component) => ({
      queryKey: ["component-output-order", component.component_product_id, organizationId],
      queryFn: async () => {
        if (!organizationId) return { productId: component.component_product_id, order: null };
        const { data, error } = await supabase
          .from("product_output_order")
          .select("output_order")
          .eq("easyquote_product_id", component.component_product_id)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (error) throw error;
        return { productId: component.component_product_id, order: data?.output_order || null };
      },
      enabled: !!component.component_product_id && !!organizationId,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Mapa de productId -> orden de outputs guardado
  const componentOutputOrderMap = useMemo(() => {
    const map = new Map<string, string[] | null>();
    for (const query of componentOutputOrderQueries) {
      if (query.data) {
        map.set(query.data.productId, query.data.order);
      }
    }
    return map;
  }, [componentOutputOrderQueries]);

  // Query para obtener las DEFINICIONES de outputs de cada componente (contienen nameCell)
  // La API de pricing no devuelve nameCell, pero las definiciones sí
  const componentOutputDefinitionsQueries = useQueries({
    queries: activeComponents.map((component) => ({
      queryKey: ["component-output-definitions", component.component_product_id],
      queryFn: async () => {
        const token = await getEasyQuoteToken();
        if (!token) return { productId: component.component_product_id, definitions: [] };
        const { data, error } = await invokeEasyQuoteFunction("easyquote-outputs", {
          token,
          productId: component.component_product_id,
        });
        if (error) {
          console.error("[CompositeComponentTabs] Error fetching component output definitions", error);
          return { productId: component.component_product_id, definitions: [] };
        }
        const list = Array.isArray(data) ? data : data?.items || data?.data || [];
        return { productId: component.component_product_id, definitions: Array.isArray(list) ? list : [] };
      },
      enabled: !!component.component_product_id,
      staleTime: 30 * 60 * 1000, // 30 minutos - las definiciones casi nunca cambian
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  // Mapa: productId -> Map<normalizedLabel, nameCell>
  // Permite traducir el label del output de pricing a la celda de la definición
  const componentOutputLabelToCellMap = useMemo(() => {
    const productMap = new Map<string, Map<string, string>>();
    // Normalización agresiva para poder mapear labels con/ sin tildes, símbolos, etc.
    // Ej: "Mejor opción" -> "mejor opcion"
    const normalizeLabel = (v: any) =>
      String(v ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    
    for (const query of componentOutputDefinitionsQueries) {
      if (query.data?.definitions) {
        const labelMap = new Map<string, string>();
        for (const def of query.data.definitions as any[]) {
          const nameCell = String(def?.nameCell ?? def?.name_cell ?? "").replace(/\$/g, "").trim().toUpperCase();
          if (!nameCell) continue;
          
          // Usar outputText como label de referencia (es lo que devuelve pricing como "label")
          const outputText = def?.outputText ?? def?.output_text ?? def?.label ?? def?.name ?? "";
          if (outputText) {
            labelMap.set(normalizeLabel(outputText), nameCell);
          }
        }
        productMap.set(query.data.productId, labelMap);
      }
    }
    return productMap;
  }, [componentOutputDefinitionsQueries]);

  // Función para ordenar outputs según el orden guardado.
  // Si NO hay orden guardado, aplicamos el "orden universal" (por celda del Excel),
  // igual que en el resto de vistas.
  // Usa el mapa label -> nameCell para traducir outputs de pricing.
  const sortOutputsByOrder = useCallback(
    (outputs: any[], savedOrder: string[] | null, productId: string): any[] => {
      if (!Array.isArray(outputs) || outputs.length === 0) return outputs;

      const normalizeKey = (s: any) =>
        String(s ?? "")
          .replace(/\$/g, "")
          .trim()
          .toUpperCase();

      const normalizeLabel = (v: any) =>
        String(v ?? "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const parseCell = (cellRaw: any): { col: number; row: number } | null => {
        const cell = normalizeKey(cellRaw);
        const m = cell.match(/^([A-Z]{1,3})(\d{1,4})$/);
        if (!m) return null;
        const [, letters, rowStr] = m;
        const row = Number(rowStr);
        const col = letters
          .split("")
          .reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
        if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
        return { col, row };
      };

      // Obtener el mapa label -> cell para este producto
      const labelToCell = componentOutputLabelToCellMap.get(productId);

      const getCellKeyFromOutput = (o: any): string | null => {
        let key = o?.nameCell || o?.outputNameCell || o?.name_cell;
        if (!key && labelToCell) {
          const label = normalizeLabel(o?.label ?? o?.outputText ?? o?.name);
          key = labelToCell.get(label);
        }
        const normalized = normalizeKey(key);
        return normalized ? normalized : null;
      };

      const orderMap =
        savedOrder && savedOrder.length > 0
          ? new Map(savedOrder.map((cell, idx) => [normalizeKey(cell), idx]))
          : null;
      const originalIndex = new Map<any, number>(outputs.map((o, idx) => [o, idx]));

      return [...outputs].sort((a, b) => {
        const cellA = getCellKeyFromOutput(a);
        const cellB = getCellKeyFromOutput(b);

        // 1) Si hay orden guardado, priorizarlo
        if (orderMap) {
          const orderA = cellA && orderMap.has(cellA) ? orderMap.get(cellA)! : 9999;
          const orderB = cellB && orderMap.has(cellB) ? orderMap.get(cellB)! : 9999;
          if (orderA !== orderB) return orderA - orderB;
        }

        // 2) Orden universal: por celda del Excel (columna, luego fila): E6 antes que E7
        const parsedA = cellA ? parseCell(cellA) : null;
        const parsedB = cellB ? parseCell(cellB) : null;
        if (parsedA && parsedB) {
          if (parsedA.col !== parsedB.col) return parsedA.col - parsedB.col;
          if (parsedA.row !== parsedB.row) return parsedA.row - parsedB.row;
        } else if (parsedA && !parsedB) {
          return -1;
        } else if (!parsedA && parsedB) {
          return 1;
        }

        // Estable: mantener el orden original si no podemos decidir
        return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
      });
    },
    [componentOutputLabelToCellMap]
  );

  // Procesar datos de componentes usando key única por instancia
  const componentsData = useMemo(() => {
    const data: ComponentsDataMap = {};

    // Contar instancias por component.id para decidir si añadir sufijo numérico
    const instanceCountById = new Map<string, number>();
    for (const c of activeComponents) {
      instanceCountById.set(c.id, (instanceCountById.get(c.id) ?? 0) + 1);
    }

    activeComponents.forEach((component, index) => {
      const componentKey = getActiveComponentKey(component);
      const query = componentQueriesResults[index];
      const pricingData = query?.data;
      const baseName = productNames.get(component.component_product_id) || component.component_alias;
      const count = instanceCountById.get(component.id) ?? 0;
      const alias = count > 1 ? `${baseName} ${component.instance_index ?? 1}` : baseName;

      // Obtener orden guardado para este componente
      const savedOrder = componentOutputOrderMap.get(component.component_product_id);
      const rawOutputs = pricingData?.outputs || [];
      const sortedOutputs = sortOutputsByOrder(rawOutputs, savedOrder, component.component_product_id);

      data[componentKey] = {
        prompts: pricingData?.prompts || [],
        outputs: sortedOutputs,
        price: pricingData?.price ?? 0,
        isLoading: query?.isLoading ?? false,
        alias,
      };
    });

    return data;
  }, [activeComponents, componentQueriesResults, productNames, componentOutputOrderMap, sortOutputsByOrder]);

  // Calcular precio total
  const totalPrice = useMemo(() => {
    return Object.values(componentsData).reduce((sum, data) => sum + data.price, 0);
  }, [componentsData]);

  // Calcular outputs agregados según configuración de composite_output_aggregations
  const aggregatedOutputs = useMemo(() => {
    if (!Object.keys(componentsData).length) return [];

    // Normalizador simple para identificar "lomo" aunque haya sufijos ("Lomo mm", etc.)
    const normalizeLoose = (v: any) =>
      String(v ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const isLomoLike = (v: any) => normalizeLoose(v).includes("lomo");

    // Fallback: si NO hay configuración, intentar agregar automáticamente SOLO "Lomo".
    // Esto cubre el caso típico de encuadernados (lomo de interiores -> lomo general).
    if (!outputAggregations.length) {
      const parentLomo = (parentOutputs as any[]).find(
        (o: any) => isLomoLike(o?.label) || isLomoLike(o?.name) || isLomoLike(o?.id)
      );

      if (!parentLomo) return [];

      let sum = 0;
      let found = false;

      for (const compData of Object.values(componentsData)) {
        const outputs = compData.outputs || [];
        for (const out of outputs as any[]) {
          const outName = out?.name ?? out?.id;
          const outLabel = out?.label;
          if (!isLomoLike(outLabel) && !isLomoLike(outName)) continue;

          const raw = String(out?.value ?? "");
          const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
          if (Number.isFinite(num)) {
            sum += num;
            found = true;
          }
        }
      }

      if (!found) return [];

      const targetName = String(parentLomo?.name ?? parentLomo?.id ?? "LOMO");
      const targetLabel = String(parentLomo?.label ?? "Lomo");

      return [
        {
          name: targetName,
          label: targetLabel,
          value: sum.toFixed(2).replace(".", ","),
          type: "number",
          isAggregated: true,
        },
      ];
    }

    // Agrupar outputs por source_output_name y sumar valores
    const aggregationMap = new Map<string, { sum: number; label: string; targetName: string }>();

    for (const agg of outputAggregations as any[]) {
      const sourceOutputName = String(agg.source_output_name || "").trim();
      const targetOutputName = String(agg.target_output_name || "").trim();
      const targetOutputLabel = String(agg.target_output_label || targetOutputName).trim();
      
      if (!sourceOutputName || !targetOutputName) continue;

      // Sumar este output de todos los componentes
      for (const [componentKey, compData] of Object.entries(componentsData)) {
        const outputs = compData.outputs || [];
        // Buscar el output que coincida con source_output_name
        for (const out of outputs as any[]) {
          const outName = String(out?.name || out?.id || "").trim();
          const outLabel = String(out?.label || "").trim();
          
          // Comparar por name o label (normalizando)
          const matchesName = outName.toLowerCase() === sourceOutputName.toLowerCase();
          const matchesLabel = outLabel.toLowerCase() === sourceOutputName.toLowerCase();
          
          if (matchesName || matchesLabel) {
            // Parsear valor numérico
            const rawValue = String(out?.value ?? "0");
            const numericValue = parseFloat(rawValue.replace(/\./g, "").replace(",", ".")) || 0;
            
            const current = aggregationMap.get(targetOutputName);
            if (current) {
              current.sum += numericValue;
            } else {
              aggregationMap.set(targetOutputName, {
                sum: numericValue,
                label: targetOutputLabel,
                targetName: targetOutputName,
              });
            }
          }
        }
      }
    }

    // Convertir a array de outputs
    const result: any[] = [];
    for (const [targetName, data] of aggregationMap) {
      result.push({
        name: targetName,
        label: data.label,
        value: data.sum.toFixed(2).replace(".", ","), // Formato español
        type: "number",
        isAggregated: true, // Flag para identificar que es un valor agregado
      });
    }

    console.log("[CompositeComponentTabs] Aggregated outputs calculated:", result);
    return result;
  }, [outputAggregations, componentsData, parentOutputs]);

  // Combinar outputs del padre con outputs agregados de componentes
  const combinedParentOutputs = useMemo(() => {
    if (!aggregatedOutputs.length) return parentOutputs;

    // Crear un mapa de outputs del padre por nombre para actualizar/añadir
    const outputsMap = new Map<string, any>();
    for (const out of parentOutputs as any[]) {
      const name = String(out?.name || out?.id || "").trim().toLowerCase();
      if (name) outputsMap.set(name, { ...out });
    }

    // Añadir o actualizar con valores agregados
    for (const aggOut of aggregatedOutputs) {
      const targetName = String(aggOut.name || "").trim().toLowerCase();
      if (outputsMap.has(targetName)) {
        // Actualizar el valor existente
        const existing = outputsMap.get(targetName)!;
        existing.value = aggOut.value;
        existing.isAggregated = true;
      } else {
        // Añadir nuevo output
        outputsMap.set(targetName, aggOut);
      }
    }

    return Array.from(outputsMap.values());
  }, [parentOutputs, aggregatedOutputs]);

  // Notificar cambios en los datos de componentes al padre (incluye outputs del padre + agregados)
  useEffect(() => {
    onComponentsDataChange?.(componentsData, totalPrice, combinedParentOutputs);
  }, [componentsData, totalPrice, combinedParentOutputs, onComponentsDataChange]);

  // Auto-seleccionar el primer componente al cargar (usando key única)
  useEffect(() => {
    if (activeComponents.length > 0 && !activeTab) {
      const firstComponentKey = getActiveComponentKey(activeComponents[0]);
      setActiveTab(firstComponentKey);
      onComponentChange?.(firstComponentKey);
    }
  }, [activeComponents, activeTab, onComponentChange]);

  // Manejar cambio de tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onComponentChange?.(value);
  };

  // Obtener label del componente (con sufijo numérico si hay múltiples instancias)
  const getComponentLabel = (component: ActiveComponent) => {
    const componentKey = getActiveComponentKey(component);
    return componentsData[componentKey]?.alias || productNames.get(component.component_product_id) || component.component_alias;
  };

  // Obtener IDs de prompts mapeados para un componente (por key de instancia)
  // NOTA: Las conexiones pueden usar target_component_id como el ID del registro O el product_id
  const getMappedPromptIds = (componentKey: string): Set<string> => {
    // Buscar el componente activo por key (puede incluir instance_index)
    const component = activeComponents.find(c => getActiveComponentKey(c) === componentKey);
    if (!component) return new Set();
    
    const componentProductId = component.component_product_id;
    
    // Buscar conexiones por ambos: el ID del registro y el product_id
    const connections = promptConnections.filter(
      (conn: any) => 
        conn.target_component_id === component.id || 
        conn.target_component_id === componentProductId
    );
    const mappedIds = new Set(connections.map((conn: any) => conn.target_prompt_name));
    
    console.log("[CompositeComponentTabs] getMappedPromptIds", {
      componentKey,
      componentId: component.id,
      componentProductId,
      allConnections: promptConnections.length,
      matchingConnections: connections.length,
      mappedIds: Array.from(mappedIds),
    });
    
    return mappedIds;
  };

  // Fetch definiciones de prompts de cada componente (para mapear UUID -> celda)
  // IMPORTANTE: este queryKey se comparte con otras pantallas (p.ej. ComponentTabsPromptsForm).
  // Por eso la data DEBE ser siempre un array. Si aquí devolvemos un objeto {definitions: ...},
  // se contamina la cache y revienta con “is not iterable”.
  const componentPromptDefinitionsQueries = useQueries({
    queries: activeComponents.map((component) => ({
      queryKey: ["easyquote-prompts-definitions", component.component_product_id],
      queryFn: async () => {
        const token = await getEasyQuoteToken();
        if (!token) return [];
        const { data, error } = await invokeEasyQuoteFunction<any[]>("easyquote-prompts", {
          token,
          productId: component.component_product_id,
        });
        if (error) {
          console.error("[CompositeComponentTabs] Error fetching component prompt definitions", error);
          return [];
        }
        return Array.isArray(data) ? data : [];
      },
      enabled: !!component.component_product_id,
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  // Mapa: componentKey -> Map<UUID, celda>
  // NOTA: Las definiciones de prompts dependen solo del component_product_id (no de la instancia).
  // Usamos component_product_id como key secundaria para reutilizar cache.
  const componentPromptCellLookups = useMemo(() => {
    const lookups = new Map<string, Map<string, string>>();

    activeComponents.forEach((component, idx) => {
      const componentKey = getActiveComponentKey(component);
      const query = componentPromptDefinitionsQueries[idx];
      const defs = Array.isArray(query?.data) ? (query!.data as any[]) : [];
      if (!defs.length) {
        lookups.set(componentKey, new Map());
        // Fallback: también mapear el component.id simple para compatibilidad
        lookups.set(component.id, new Map());
        return;
      }

      const map = new Map<string, string>();
      for (const p of defs) {
        const rawCell = getPromptCell(p);
        const cell = extractCellRef(rawCell) ?? normalizePromptName(rawCell);
        if (!cell) continue;

        const uuid = String(p?.id ?? "").trim();
        if (uuid) {
          map.set(uuid, cell);
          map.set(uuid.toUpperCase(), cell);
          map.set(uuid.toLowerCase(), cell);
        }
        map.set(cell, cell);
      }

      lookups.set(componentKey, map);
      // Fallback: también mapear el component.id simple para compatibilidad
      lookups.set(component.id, map);
    });

    return lookups;
  }, [activeComponents, componentPromptDefinitionsQueries]);

  // Hook para obtener configuración de force_result de cada componente
  // Estas settings dependen del component_product_id, así que usamos ese como queryKey.
  const componentPromptSettingsQueries = useQueries({
    queries: activeComponents.map((component) => {
      const componentKey = getActiveComponentKey(component);
      return {
        // IMPORTANTE: incluir componentKey para que cada instancia tenga su propia entrada en el mapa
        queryKey: ["component-prompt-settings", component.component_product_id, componentKey],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("product_prompt_settings")
            .select("*")
            .eq("easyquote_product_id", component.component_product_id);
          if (error) throw error;
          // Devolvemos componentKey en lugar de component.id para mapear correctamente
          return { componentKey, componentId: component.id, productId: component.component_product_id, settings: data || [] };
        },
        enabled: !!component.component_product_id,
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  // Mapa: componentKey -> Set de prompt_names (celdas) que son force_result
  const componentForceResultMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const query of componentPromptSettingsQueries) {
      if (query.data) {
        const forceResultNames = new Set<string>();
        for (const setting of query.data.settings as any[]) {
          if (setting.force_result) {
            forceResultNames.add(normalizePromptName(setting.prompt_name));
          }
        }
        map.set(query.data.componentKey, forceResultNames);
        // Fallback con component.id para compatibilidad
        map.set(query.data.componentId, forceResultNames);
      }
    }
    return map;
  }, [componentPromptSettingsQueries]);

  // Mapa: componentKey -> Set de prompt_names (celdas) que son admin_only
  // (para poder ocultarlas a usuarios no-admin también en la sección de restrictivas)
  const componentAdminOnlyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const query of componentPromptSettingsQueries) {
      if (query.data) {
        const adminOnlyNames = new Set<string>();
        for (const setting of query.data.settings as any[]) {
          if (setting.admin_only) {
            adminOnlyNames.add(normalizePromptName(setting.prompt_name));
          }
        }
        map.set(query.data.componentKey, adminOnlyNames);
        // Fallback con component.id para compatibilidad
        map.set(query.data.componentId, adminOnlyNames);
      }
    }
    return map;
  }, [componentPromptSettingsQueries]);

  // Obtener la celda de un prompt de componente (UUID -> celda)
  // Acepta componentKey (id:instance_index) o component.id como fallback
  const getComponentPromptCell = useCallback((componentKeyOrId: string, promptId: string): string => {
    const lookup = componentPromptCellLookups.get(componentKeyOrId);
    if (!lookup) return extractCellRef(promptId) ?? normalizePromptName(promptId);
    const cell = lookup.get(promptId) ?? lookup.get(promptId.toUpperCase()) ?? lookup.get(promptId.toLowerCase());
    return cell ?? extractCellRef(promptId) ?? normalizePromptName(promptId);
  }, [componentPromptCellLookups]);

  // Verificar si un prompt de un componente es force_result
  // Acepta componentKey (id:instance_index) o component.id como fallback
  const isComponentPromptForceResult = useCallback((componentKeyOrId: string, promptId: string): boolean => {
    const forceResultSet = componentForceResultMap.get(componentKeyOrId);
    if (!forceResultSet) return false;
    const cellRef = getComponentPromptCell(componentKeyOrId, promptId);
    return forceResultSet.has(normalizePromptName(cellRef));
  }, [componentForceResultMap, getComponentPromptCell]);

  // Verificar si un prompt de un componente es admin_only
  // Acepta componentKey (id:instance_index) o component.id como fallback
  const isComponentPromptAdminOnly = useCallback((componentKeyOrId: string, promptId: string): boolean => {
    const adminOnlySet = componentAdminOnlyMap.get(componentKeyOrId);
    if (!adminOnlySet) return false;
    const cellRef = getComponentPromptCell(componentKeyOrId, promptId);
    return adminOnlySet.has(normalizePromptName(cellRef));
  }, [componentAdminOnlyMap, getComponentPromptCell]);

  // Crear producto virtual para el componente (SOLO prompts NO mapeados y NO force_result)
  // Acepta componentKey (id:instance_index)
  const createComponentProduct = (componentKey: string) => {
    const componentData = componentsData[componentKey];
    if (!componentData) return null;

    const mappedIds = getMappedPromptIds(componentKey);
    
    // Filtrar: solo prompts NO mapeados (los mapeados vienen del padre) y NO force_result
    const prompts = componentData.prompts.filter((p: any) => {
      if (mappedIds.has(String(p.id))) return false;
      // Excluir force_result (se mostrarán en sección aparte)
      return !isComponentPromptForceResult(componentKey, String(p.id));
    });

    return { prompts };
  };

  // Obtener prompts force_result de un componente
  // Acepta componentKey (id:instance_index)
  const getComponentForceResultPrompts = (componentKey: string): any[] => {
    const componentData = componentsData[componentKey];
    if (!componentData) return [];

    const mappedIds = getMappedPromptIds(componentKey);

    // Filtrar: solo prompts force_result que:
    // 1. NO estén mapeados (los mapeados ya se ven en el padre, ej: Tarifa/B10)
    // 2. Si no es admin, excluir admin_only
    return componentData.prompts.filter((p: any) => {
      const id = String(p.id);
      // Excluir mapeados (heredados del padre)
      if (mappedIds.has(id)) return false;
      // Solo incluir si es force_result
      if (!isComponentPromptForceResult(componentKey, id)) return false;
      // Excluir admin_only si no es admin
      if (!isAdmin && isComponentPromptAdminOnly(componentKey, id)) return false;
      return true;
    });
  };

  // Obtener valores de prompts para un componente específico
  // Combina: valores de la API (currentValue) + valores editados por el usuario (componentPromptValues)
  // Acepta componentKey (id:instance_index)
  const getComponentPromptValues = (componentKey: string): Record<string, any> => {
    const componentData = componentsData[componentKey];
    if (!componentData) return componentPromptValues[componentKey] || {};

    const values: Record<string, any> = {};
    // 1. Primero, valores de la API
    for (const prompt of componentData.prompts) {
      values[prompt.id] = prompt.currentValue ?? prompt.default ?? "";
    }
    // 2. Luego, valores editados por el usuario (sobrescriben)
    const userEdited = componentPromptValues[componentKey] || {};
    for (const [promptId, value] of Object.entries(userEdited)) {
      if (value !== undefined) {
        values[promptId] = value;
      }
    }
    return values;
  };

  return (
    <div className="space-y-3">
      {/* Header con título y tabs de componentes en la misma línea */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Configuración del producto</h3>
        {activeComponents.length > 0 && (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-auto gap-1">
              {activeComponents.map((component) => {
                const componentKey = getActiveComponentKey(component);
                return (
                  <TabsTrigger 
                    key={componentKey} 
                    value={componentKey}
                    className="relative flex items-center gap-1.5"
                  >
                    {getComponentLabel(component)}
                    {componentsData[componentKey]?.isLoading && (
                      <span className="text-xs text-muted-foreground">...</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Layout de dos columnas alineadas arriba */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* COLUMNA IZQUIERDA: Prompts del producto padre (generales) */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Datos generales</h4>
          {parentRegularPrompts.length > 0 ? (
            <PromptsForm
              product={parentRegularProduct}
              values={parentPromptValues}
              onChange={onParentPromptChange}
              onCommit={onParentPromptCommit}
              showAllPrompts={isAdmin}
              singleColumn
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin prompts configurados</p>
          )}

          {/* Opciones restrictivas del padre (force_result) */}
          {parentForceResultPrompts.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h5 className="text-sm font-semibold text-muted-foreground mb-3">Opciones restrictivas</h5>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {parentForceResultPrompts.map((prompt) => {
                  const effectiveValue = parentPromptValues[prompt.id];
                  const value =
                    effectiveValue && typeof effectiveValue === "object" && "value" in effectiveValue
                      ? (effectiveValue as any).value
                      : effectiveValue ?? prompt.default;

                  if (prompt.type === "checkbox") {
                    const isChecked =
                      value === true ||
                      value === "true" ||
                      value === "Sí" ||
                      value === "Si" ||
                      value === 1 ||
                      value === "1";
                    return (
                      <div key={prompt.id} className="flex items-center gap-2 py-1">
                        <span className="text-sm">{prompt.label}</span>
                        <Checkbox
                          id={`restrictive-parent-${prompt.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const newValue = checked ? "Sí" : "No";
                            onParentPromptChange(prompt.id, newValue);
                            onParentPromptCommit?.(prompt.id, newValue);
                          }}
                        />
                      </div>
                    );
                  }

                  if (prompt.type === "select" && prompt.options?.length) {
                    return (
                      <div key={prompt.id} className="flex items-center gap-2 py-1">
                        <span className="text-sm">{prompt.label}</span>
                        <Select
                          value={String(value ?? "")}
                          onValueChange={(v) => {
                            onParentPromptChange(prompt.id, v);
                            onParentPromptCommit?.(prompt.id, v);
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

                  return (
                    <div key={prompt.id} className="flex items-center gap-2 py-1">
                      <span className="text-sm">{prompt.label}</span>
                      <Input
                        type={prompt.type === "number" || prompt.type === "integer" ? "number" : "text"}
                        className="h-8 w-24"
                        value={value ?? ""}
                        onChange={(e) => onParentPromptChange(prompt.id, e.target.value)}
                        onBlur={(e) => onParentPromptCommit?.(prompt.id, e.target.value)}
                        onKeyDown={handleEnterToBlur}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: Prompts del componente seleccionado */}
        <div className="rounded-lg border border-border bg-card p-4">
          {activeComponents.length > 0 ? (
            <>
              {activeComponents.map((component) => {
                const componentKey = getActiveComponentKey(component);
                if (componentKey !== activeTab) return null;
                const componentProduct = createComponentProduct(componentKey);
                const componentValues = getComponentPromptValues(componentKey);
                const componentForceResultPrompts = getComponentForceResultPrompts(componentKey);
                const isLoadingComponent = componentsData[componentKey]?.isLoading;

                return (
                  <div key={componentKey}>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      {getComponentLabel(component)}
                    </h4>
                    {isLoadingComponent ? (
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : componentProduct?.prompts?.length ? (
                      <PromptsForm
                        product={componentProduct}
                        values={componentValues}
                        onChange={(promptId, value) => {
                          onComponentPromptChange?.(componentKey, promptId, value);
                        }}
                        onCommit={(promptId, value) => {
                          onComponentPromptCommit?.(componentKey, promptId, value);
                        }}
                        showAllPrompts={isAdmin}
                        singleColumn
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sin opciones para este componente
                      </p>
                    )}

                    {/* Opciones restrictivas del componente (force_result) */}
                    {componentForceResultPrompts.length > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <h5 className="text-sm font-semibold text-muted-foreground mb-3">Opciones restrictivas</h5>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                          {componentForceResultPrompts.map((prompt: any) => {
                            const value = componentValues[prompt.id] ?? prompt.currentValue ?? prompt.default;
                            const typeKey = getPromptTypeKey(prompt);

                            if (typeKey.includes("check") || typeKey.includes("boolean")) {
                              const isChecked =
                                value === true ||
                                value === "true" ||
                                value === "Sí" ||
                                value === "Si" ||
                                value === 1 ||
                                value === "1";
                              return (
                                <div key={prompt.id} className="flex items-center gap-2 py-1">
                                  <span className="text-sm">{prompt.promptText || prompt.label || prompt.id}</span>
                                  <Checkbox
                                    id={`restrictive-component-${componentKey}-${prompt.id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const newValue = checked ? "Sí" : "No";
                                      onComponentPromptChange?.(componentKey, prompt.id, newValue);
                                      onComponentPromptCommit?.(componentKey, prompt.id, newValue);
                                    }}
                                  />
                                </div>
                              );
                            }

                            const options = normalizeValueOptions(prompt);
                            const isSelectType =
                              typeKey.includes("drop") || typeKey.includes("select") || typeKey.includes("list");

                            if (isSelectType && options.length) {
                              const valueStr = value === undefined || value === null ? "" : String(value);
                              const isValid = valueStr === "" || options.some((o) => o.value === valueStr);
                              return (
                                <div key={prompt.id} className="flex items-center gap-2 py-1">
                                  <span className="text-sm">{prompt.promptText || prompt.label || prompt.id}</span>
                                  <Select
                                    value={isValid ? valueStr : ""}
                                    onValueChange={(val) => {
                                      onComponentPromptChange?.(componentKey, prompt.id, val);
                                      onComponentPromptCommit?.(componentKey, prompt.id, val);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-auto min-w-[100px]">
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent className="z-50 bg-popover">
                                      {options.map((o, idx: number) => (
                                        <SelectItem key={`${o.value}-${idx}`} value={o.value}>
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            }

                            return (
                              <div key={prompt.id} className="flex items-center gap-2 py-1">
                                <span className="text-sm">{prompt.promptText || prompt.label || prompt.id}</span>
                                <Input
                                  type={
                                    typeKey.includes("number") ||
                                    typeKey.includes("decimal") ||
                                    typeKey.includes("float") ||
                                    typeKey.includes("int")
                                      ? "number"
                                      : "text"
                                  }
                                  className="h-8 w-24"
                                  value={value ?? ""}
                                  onChange={(e) => onComponentPromptChange?.(componentKey, prompt.id, e.target.value)}
                                  onBlur={(e) => onComponentPromptCommit?.(componentKey, prompt.id, e.target.value)}
                                  onKeyDown={handleEnterToBlur}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No hay componentes activos</p>
          )}
        </div>
      </div>
    </div>
  );
}
