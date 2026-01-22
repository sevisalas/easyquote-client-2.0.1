import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
 * Componente que muestra:
 * - IZQUIERDA: Prompts del producto padre (General)
 * - DERECHA: Tabs con componentes, mostrando datos heredados (automáticos) del componente seleccionado
 * 
 * Los outputs/resultados se exponen vía callback para mostrarse en el panel lateral de Resultados.
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

  // Renderizar contenido del componente seleccionado
  const renderComponentContent = () => {
    if (!activeTab || !componentsData[activeTab]) {
      return (
        <p className="text-sm text-muted-foreground">Selecciona un componente</p>
      );
    }

    const data = componentsData[activeTab];
    
    if (data.isLoading) {
      return (
        <p className="text-sm text-muted-foreground">Cargando datos del componente...</p>
      );
    }

    // Mostrar prompts heredados (los que vienen de las conexiones)
    const connections = promptConnections.filter(
      (conn: any) => conn.target_component_id === activeTab
    );

    // Datos heredados del padre
    const inheritedData = connections.map((conn: any) => {
      const parentValue = parentPromptValues[conn.source_prompt_name];
      // Buscar el label del prompt del padre
      const parentPrompt = parentProduct?.prompts?.find(
        (p: any) => p.id === conn.source_prompt_name || p.name === conn.source_prompt_name
      );
      const label = parentPrompt?.promptText || parentPrompt?.label || conn.source_prompt_name;
      return {
        label,
        value: parentValue ?? "—",
        targetPrompt: conn.target_prompt_name,
      };
    });

    return (
      <div className="space-y-4">
        {/* Datos heredados del padre */}
        {inheritedData.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium">Datos heredados del padre</span>
              <Badge variant="secondary" className="text-xs">Automático</Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {inheritedData.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">{item.label}</span>
                  <span className="font-medium">{String(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Datos propios del componente (no heredados) */}
        {data.prompts.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium">Datos del componente</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {data.prompts.slice(0, 12).map((prompt: any, idx: number) => {
                // Verificar si este prompt es heredado
                const isInherited = connections.some(
                  (conn: any) => conn.target_prompt_name === prompt.id
                );
                if (isInherited) return null; // Ya se mostró arriba
                
                return (
                  <div key={`${prompt.id}-${idx}`} className="flex justify-between gap-2">
                    <span className="text-muted-foreground truncate">
                      {prompt.promptText || prompt.label || prompt.name || prompt.id}
                    </span>
                    <span className="font-medium">
                      {String(prompt.currentValue ?? prompt.defaultValue ?? "—")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Si no hay componentes activos, solo mostrar prompts del padre
  if (activeComponents.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Configuración del producto</h3>
        {parentProduct?.prompts && (
          <PromptsForm
            product={parentProduct}
            values={parentPromptValues}
            onChange={onParentPromptChange}
            onCommit={onParentPromptCommit}
            showAllPrompts={isAdmin}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con título y tabs de componentes */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h3 className="font-medium whitespace-nowrap">Configuración del producto</h3>

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
      </div>

      {/* Contenido: dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Columna izquierda: Prompts del padre (General) */}
        {parentProduct?.prompts && (
          <div className="rounded-lg border border-border bg-card p-4 self-start">
            <PromptsForm
              product={parentProduct}
              values={parentPromptValues}
              onChange={onParentPromptChange}
              onCommit={onParentPromptCommit}
              showAllPrompts={isAdmin}
              singleColumn
            />
          </div>
        )}

        {/* Columna derecha: Datos del componente seleccionado */}
        <div className="rounded-lg border border-border bg-card p-4 self-start min-h-[200px]">
          {renderComponentContent()}
        </div>
      </div>
    </div>
  );
}
