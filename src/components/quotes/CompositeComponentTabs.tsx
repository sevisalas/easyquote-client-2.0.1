import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
 * Componente que replica el layout del sistema legacy:
 * - IZQUIERDA: Prompts del producto padre (formulario editable)
 * - TABS arriba a la derecha: Selector de componente
 * - DERECHA (panel Resultados externo): Outputs del componente seleccionado
 * 
 * Los datos heredados se propagan automáticamente a los componentes según las conexiones
 * configuradas en la base de datos - NO se muestran como texto estático.
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

  return (
    <div className="space-y-4">
      {/* Header con título y tabs de componentes */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h3 className="font-medium whitespace-nowrap">Configuración del producto</h3>

        {activeComponents.length > 0 && (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex-wrap h-auto gap-1">
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

      {/* Formulario de prompts del padre - ocupa todo el ancho */}
      {parentProduct?.prompts && (
        <div className="rounded-lg border border-border bg-card p-4">
          <PromptsForm
            product={parentProduct}
            values={parentPromptValues}
            onChange={onParentPromptChange}
            onCommit={onParentPromptCommit}
            showAllPrompts={isAdmin}
          />
        </div>
      )}
    </div>
  );
}
