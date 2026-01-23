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

  // Igual que en PromptsForm: no “commit” mientras se escribe; Enter hace blur y el blur comitea.
  const handleEnterToBlur = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }, []);

  // Hook para obtener configuración de prompts (force_result, admin_only, etc.)
  const { isPromptForceResult } = useProductPromptSettings(parentProductId);

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
  const { data: promptConnections = [] } = useQuery({
    queryKey: ["composite-prompt-connections", parentProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("composite_prompt_connections")
        .select("*")
        .eq("composite_product_id", parentProductId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!parentProductId,
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

  // Separar prompts del padre en regulares y force_result
  const { parentRegularPrompts, parentForceResultPrompts } = useMemo(() => {
    const allPrompts = extractPrompts(parentProduct);
    const regular: PromptDef[] = [];
    const forceResult: PromptDef[] = [];

    for (const prompt of allPrompts) {
      const key = getParentPromptAdminKey(prompt);
      if (isPromptForceResult(key)) forceResult.push(prompt);
      else regular.push(prompt);
    }

    return { parentRegularPrompts: regular, parentForceResultPrompts: forceResult };
  }, [parentProduct, isPromptForceResult, getParentPromptAdminKey]);

  // Producto virtual para prompts regulares del padre
  const parentRegularProduct = useMemo(() => {
    return { prompts: parentRegularPrompts };
  }, [parentRegularPrompts]);

  // Verificar si hay valores de prompts padre disponibles
  // Esto evita llamar a la API de componentes antes de tener los valores del padre
  const hasParentValues = Object.keys(parentPromptValues).length > 0;

  // Query para obtener outputs del producto PADRE (ancho, alto, etc.)
  const { data: parentPricingData } = useQuery({
    queryKey: ["parent-pricing-outputs", parentProductId, JSON.stringify(parentPromptValues)],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) throw new Error("No hay token");

      // Preparar inputs del padre
      const parentInputs: { id: string; value: any }[] = [];
      
      // Obtener valores actuales de prompts del padre
      const parentPrompts = parentProduct?.prompts || [];
      for (const p of parentPrompts) {
        const id = String(p?.id ?? "");
        if (!id) continue;
        
        // Usar valor del estado si existe, si no usar currentValue del producto
        const value = parentPromptValues[id] ?? p?.currentValue;
        if (value !== undefined && value !== null) {
          parentInputs.push({ id, value });
        }
      }

      console.log("[CompositeComponentTabs] Fetching parent outputs", {
        parentProductId,
        inputsCount: parentInputs.length,
      });

      const { data, error } = await invokeEasyQuoteFunction("easyquote-pricing", {
        token,
        productId: parentProductId,
        inputs: parentInputs,
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
            let sourceValue = parentPromptValues[conn.source_prompt_name];
            
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
        enabled: !!component.component_product_id && promptConnections !== undefined && hasParentValues,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
      };
    }),
  });

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

      data[componentKey] = {
        prompts: pricingData?.prompts || [],
        outputs: pricingData?.outputs || [],
        price: pricingData?.price ?? 0,
        isLoading: query?.isLoading ?? false,
        alias,
      };
    });

    return data;
  }, [activeComponents, componentQueriesResults, productNames]);

  // Calcular precio total
  const totalPrice = useMemo(() => {
    return Object.values(componentsData).reduce((sum, data) => sum + data.price, 0);
  }, [componentsData]);

  // Notificar cambios en los datos de componentes al padre (incluye outputs del padre)
  useEffect(() => {
    onComponentsDataChange?.(componentsData, totalPrice, parentOutputs);
  }, [componentsData, totalPrice, parentOutputs, onComponentsDataChange]);

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
        queryKey: ["component-prompt-settings", component.component_product_id],
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
