import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
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
 * Componente que muestra tabs con los datos de entrada (prompts)
 * de cada componente activo. Similar al sistema legacy de encuadernados.
 * Los datos de salida se exponen vía callback para mostrarse en el panel lateral de Resultados.
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
  const [activeTab, setActiveTab] = useState<string>("general");

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
    if (activeComponents.length > 0 && activeTab === "general") {
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
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      {/* Header con tabs de componentes */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Configuración del producto
        </h3>
        {activeComponents.length > 0 && (
          <TabsList>
            {activeComponents.map((component) => (
              <TabsTrigger 
                key={component.id} 
                value={component.id} 
                className="gap-1.5"
              >
                {getComponentLabel(component)}
                {componentsData[component.id]?.isLoading && (
                  <span className="ml-1 text-xs text-muted-foreground">...</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
      </div>

      {/* Prompts del padre - siempre visibles */}
      {parentProduct?.prompts && (
        <PromptsForm
          product={parentProduct}
          values={parentPromptValues}
          onChange={onParentPromptChange}
          onCommit={onParentPromptCommit}
          showAllPrompts={isAdmin}
        />
      )}

      {/* Contenido de cada tab de componente */}
      {activeComponents.map((component) => (
        <TabsContent key={component.id} value={component.id} className="mt-4">
          {(() => {
            const data = componentsData[component.id];
            if (!data) return null;
            
            const displayPrompts = (data.prompts || []).map((p: any) => ({
              id: p.id,
              label: p.promptText || p.label || p.name || "",
              value: p.currentValue ?? p.defaultValue ?? "",
            }));

            if (data.isLoading) {
              return (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Cargando datos del componente...</p>
                </div>
              );
            }

            if (displayPrompts.length === 0) {
              return (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Sin parámetros adicionales para este componente</p>
                </div>
              );
            }

            return (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">Datos heredados</span>
                  <Badge variant="secondary" className="text-xs">Automático</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  {displayPrompts.slice(0, 12).map((prompt: any, idx: number) => (
                    <div key={`${prompt.id}-${idx}`} className="flex justify-between gap-2">
                      <span className="text-muted-foreground truncate">{prompt.label}</span>
                      <span className="font-medium">{String(prompt.value ?? "—")}</span>
                    </div>
                  ))}
                </div>
                {displayPrompts.length > 12 && (
                  <p className="text-xs text-muted-foreground pt-2 mt-2 border-t">
                    +{displayPrompts.length - 12} parámetros más...
                  </p>
                )}
              </div>
            );
          })()}
        </TabsContent>
      ))}
    </Tabs>
  );
}
