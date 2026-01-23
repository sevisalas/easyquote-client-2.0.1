import { useMemo, useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActiveComponent } from "./CompositeComponentsSelector";
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
}: CompositeComponentTabsProps) {
  const [activeTab, setActiveTab] = useState<string>("");

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
  const componentQueriesResults = useQueries({
    queries: activeComponents.map((component) => ({
      queryKey: ["component-pricing", component.component_product_id, component.id, JSON.stringify(parentPromptValues)],
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

        for (const conn of connections as any[]) {
          const sourceValue = parentPromptValues[conn.source_prompt_name];
          if (sourceValue !== undefined && sourceValue !== null) {
            componentInputs.push({
              id: conn.target_prompt_name,
              value: sourceValue,
            });
          }
        }
        
        console.log("[CompositeComponentTabs] API inputs for component", {
          componentId: component.id,
          componentProductId: component.component_product_id,
          connectionsFound: connections.length,
          connectionDetails: connections.map((c: any) => ({
            source: c.source_prompt_name,
            target: c.target_prompt_name,
            sourceValueExists: parentPromptValues[c.source_prompt_name] !== undefined,
            sourceValue: parentPromptValues[c.source_prompt_name],
          })),
          inputs: componentInputs,
          parentPromptValuesKeys: Object.keys(parentPromptValues),
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
    })),
  });

  // Procesar datos de componentes
  const componentsData = useMemo(() => {
    const data: ComponentsDataMap = {};

    activeComponents.forEach((component, index) => {
      const query = componentQueriesResults[index];
      const pricingData = query?.data;

      data[component.id] = {
        prompts: pricingData?.prompts || [],
        outputs: pricingData?.outputs || [],
        price: pricingData?.price ?? 0,
        isLoading: query?.isLoading ?? false,
        alias: productNames.get(component.component_product_id) || component.component_alias,
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

  // Auto-seleccionar el primer componente al cargar
  useEffect(() => {
    if (activeComponents.length > 0 && !activeTab) {
      const firstComponentId = activeComponents[0].id;
      setActiveTab(firstComponentId);
      onComponentChange?.(firstComponentId);
    }
  }, [activeComponents, activeTab, onComponentChange]);

  // Manejar cambio de tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onComponentChange?.(value);
  };

  // Obtener label del componente
  const getComponentLabel = (component: ActiveComponent) => {
    return productNames.get(component.component_product_id) || component.component_alias;
  };

  // Obtener IDs de prompts mapeados para un componente
  // NOTA: Las conexiones pueden usar target_component_id como el ID del registro O el product_id
  const getMappedPromptIds = (componentId: string): Set<string> => {
    // Buscar el component_product_id correspondiente a este componentId
    const component = activeComponents.find(c => c.id === componentId);
    const componentProductId = component?.component_product_id;
    
    // Buscar conexiones por ambos: el ID del registro y el product_id
    const connections = promptConnections.filter(
      (conn: any) => 
        conn.target_component_id === componentId || 
        conn.target_component_id === componentProductId
    );
    const mappedIds = new Set(connections.map((conn: any) => conn.target_prompt_name));
    
    console.log("[CompositeComponentTabs] getMappedPromptIds", {
      componentId,
      componentProductId,
      allConnections: promptConnections.length,
      matchingConnections: connections.length,
      mappedIds: Array.from(mappedIds),
    });
    
    return mappedIds;
  };

  // Crear producto virtual para el componente (SOLO prompts NO mapeados - los heredados se excluyen)
  const createComponentProduct = (componentId: string) => {
    const componentData = componentsData[componentId];
    if (!componentData) return null;

    const mappedIds = getMappedPromptIds(componentId);
    
    console.log("[CompositeComponentTabs] createComponentProduct", {
      componentId,
      totalPrompts: componentData.prompts.length,
      promptIds: componentData.prompts.map((p: any) => p.id),
      mappedIds: Array.from(mappedIds),
    });
    
    // Filtrar: solo prompts NO mapeados (los mapeados vienen del padre)
    const prompts = componentData.prompts.filter((p: any) => !mappedIds.has(String(p.id)));
    
    console.log("[CompositeComponentTabs] filtered prompts", prompts.length);

    return { prompts };
  };

  // Obtener valores de prompts para un componente específico
  const getComponentPromptValues = (componentId: string): Record<string, any> => {
    const componentData = componentsData[componentId];
    if (!componentData) return {};

    const values: Record<string, any> = {};
    for (const prompt of componentData.prompts) {
      values[prompt.id] = prompt.currentValue ?? prompt.default ?? "";
    }
    return values;
  };

  // El componente activo actual
  const activeComponentData = activeTab ? componentsData[activeTab] : null;

  return (
    <div className="space-y-3">
      {/* Header con título y tabs de componentes en la misma línea */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Configuración del producto</h3>
        {activeComponents.length > 0 && (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-auto gap-1">
              {activeComponents.map((component) => (
                <TabsTrigger 
                  key={component.id} 
                  value={component.id}
                  className="relative flex items-center gap-1.5"
                >
                  {getComponentLabel(component)}
                  {componentsData[component.id]?.isLoading && (
                    <span className="text-xs text-muted-foreground">...</span>
                  )}
                </TabsTrigger>
              ))}
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
          
          {/* Sección: Opciones restrictivas (prompts force_result del padre) */}
          {parentForceResultPrompts.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h5 className="text-sm font-semibold text-muted-foreground mb-3">
                Opciones restrictivas
              </h5>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {parentForceResultPrompts.map((prompt) => {
                  const effectiveValue = parentPromptValues[prompt.id];
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
                  
                  // Select type
                  if (prompt.type === 'select' && prompt.options?.length) {
                    return (
                      <div key={prompt.id} className="flex items-center gap-2 py-1">
                        <span className="text-sm">{prompt.label}</span>
                        <Select 
                          value={String(value ?? '')} 
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
                  
                  // Number/Integer/Text type
                  return (
                    <div key={prompt.id} className="flex items-center gap-2 py-1">
                      <span className="text-sm">{prompt.label}</span>
                      <Input
                        type={prompt.type === 'number' || prompt.type === 'integer' ? 'number' : 'text'}
                        className="h-8 w-24"
                        value={value ?? ''}
                        onChange={(e) => onParentPromptChange(prompt.id, e.target.value)}
                        onBlur={(e) => onParentPromptCommit?.(prompt.id, e.target.value)}
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
                if (component.id !== activeTab) return null;
                const componentProduct = createComponentProduct(component.id);
                const componentValues = getComponentPromptValues(component.id);
                const isLoading = componentsData[component.id]?.isLoading;

                return (
                  <div key={component.id}>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      {getComponentLabel(component)}
                    </h4>
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : componentProduct?.prompts?.length ? (
                      <PromptsForm
                        product={componentProduct}
                        values={componentValues}
                        onChange={() => {/* Los prompts del componente son calculados, no editables */}}
                        showAllPrompts={isAdmin}
                        singleColumn
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sin opciones para este componente
                      </p>
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
