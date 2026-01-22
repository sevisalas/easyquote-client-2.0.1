import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActiveComponent } from "./CompositeComponentsSelector";
import { useQuery, useQueries } from "@tanstack/react-query";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
import PromptsForm from "./PromptsForm";
import { supabase } from "@/integrations/supabase/client";

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
  onComponentsDataChange?: (data: ComponentsDataMap, totalPrice: number) => void;
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

  // Usar useQueries para obtener datos de todos los componentes
  const componentQueriesResults = useQueries({
    queries: activeComponents.map((component) => ({
      queryKey: ["component-pricing", component.component_product_id, component.id, JSON.stringify(parentPromptValues)],
      queryFn: async (): Promise<{ prompts: any[]; outputs: any[]; price: number }> => {
        const token = await getEasyQuoteToken();
        if (!token) throw new Error("No hay token");

        // Calcular valores de prompts para este componente basado en las conexiones
        const componentInputs: { id: string; value: any }[] = [];
        
        // Filtrar conexiones para ESTE componente específico (por id, no por component_product_id)
        const connections = promptConnections.filter(
          (conn: any) => conn.target_component_id === component.id
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
      enabled: !!component.component_product_id && promptConnections !== undefined,
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

  // Notificar cambios en los datos de componentes al padre
  useEffect(() => {
    onComponentsDataChange?.(componentsData, totalPrice);
  }, [componentsData, totalPrice, onComponentsDataChange]);

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
  const getMappedPromptIds = (componentId: string): Set<string> => {
    const connections = promptConnections.filter(
      (conn: any) => conn.target_component_id === componentId
    );
    return new Set(connections.map((conn: any) => conn.target_prompt_name));
  };

  // Crear producto virtual para el componente (solo prompts NO mapeados son editables)
  const createComponentProduct = (componentId: string) => {
    const componentData = componentsData[componentId];
    if (!componentData) return null;

    const mappedIds = getMappedPromptIds(componentId);
    
    // Todos los prompts, pero marcando los mapeados
    const prompts = componentData.prompts.map((p: any) => ({
      ...p,
      // Si está mapeado, agregar flag para mostrarlo diferente (readonly)
      isMapped: mappedIds.has(String(p.id)),
    }));

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
    <div className="space-y-4">
      {/* Header con título */}
      <h3 className="font-medium">Configuración del producto</h3>

      {/* Layout de dos columnas: Izquierda=Padre, Derecha=Componente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Prompts del producto padre (generales) */}
        <div className="rounded-lg border border-border bg-card p-4 self-start">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Datos generales</h4>
          {parentProduct?.prompts ? (
            <PromptsForm
              product={parentProduct}
              values={parentPromptValues}
              onChange={onParentPromptChange}
              onCommit={onParentPromptCommit}
              showAllPrompts={isAdmin}
              singleColumn
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin prompts configurados</p>
          )}
        </div>

        {/* COLUMNA DERECHA: Prompts del componente seleccionado */}
        <div className="rounded-lg border border-border bg-card p-4 self-start">
          {activeComponents.length > 0 ? (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
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

              {activeComponents.map((component) => {
                const componentProduct = createComponentProduct(component.id);
                const componentValues = getComponentPromptValues(component.id);
                const isLoading = componentsData[component.id]?.isLoading;

                return (
                  <TabsContent key={component.id} value={component.id} className="mt-0">
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
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground">No hay componentes activos</p>
          )}
        </div>
      </div>
    </div>
  );
}
