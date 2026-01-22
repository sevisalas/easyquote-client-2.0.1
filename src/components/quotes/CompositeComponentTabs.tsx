import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Settings } from "lucide-react";
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
  onParentPromptChange: (id: string, value: any, label: string) => void;
  /** Callback cuando se confirma un prompt del padre */
  onParentPromptCommit?: (id: string, value: any, label: string) => void;
  /** Producto detail del padre (para prompts) */
  parentProduct: any;
  /** Map de product_id -> nombre del producto */
  productNames?: Map<string, string>;
  /** Es admin (muestra todos los prompts) */
  isAdmin?: boolean;
}

interface ComponentPricingData {
  prompts: any[];
  outputs: any[];
  price: number;
}

/**
 * Componente que muestra tabs con los datos de entrada (prompts) y salida (outputs)
 * de cada componente activo en un producto compuesto.
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

  // Usar useQueries para obtener datos de todos los componentes de forma segura
  const componentQueriesResults = useQueries({
    queries: activeComponents.map((component) => ({
      queryKey: ["component-pricing", component.component_product_id, component.id, JSON.stringify(parentPromptValues)],
      queryFn: async (): Promise<ComponentPricingData> => {
        const token = await getEasyQuoteToken();
        if (!token) throw new Error("No hay token");

        // Calcular valores de prompts para este componente basado en las conexiones
        const componentInputs: { id: string; value: any }[] = [];
        
        // Buscar conexiones para este componente
        const connections = promptConnections.filter(
          (conn: any) => conn.target_component_id === component.id
        );

        for (const conn of connections as any[]) {
          const sourceValue = parentPromptValues[conn.source_prompt_name];
          if (sourceValue !== undefined && sourceValue !== null) {
            componentInputs.push({
              id: conn.target_prompt_name, // UUID del prompt del componente
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
        
        // Procesar respuesta
        const prompts = data?.prompts || [];
        const outputs = data?.outputValues || data?.outputs || [];
        
        // Extraer precio
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
    const data: Record<string, { prompts: any[]; outputs: any[]; price: number; isLoading: boolean }> = {};

    activeComponents.forEach((component, index) => {
      const query = componentQueriesResults[index];
      const pricingData = query?.data;

      data[component.id] = {
        prompts: pricingData?.prompts || [],
        outputs: pricingData?.outputs || [],
        price: pricingData?.price ?? 0,
        isLoading: query?.isLoading ?? false,
      };
    });

    return data;
  }, [activeComponents, componentQueriesResults]);

  // Calcular precio total
  const totalPrice = useMemo(() => {
    return Object.values(componentsData).reduce((sum, data) => sum + data.price, 0);
  }, [componentsData]);

  // Formatear precio
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  // Obtener label del componente
  const getComponentLabel = (component: ActiveComponent) => {
    return productNames.get(component.component_product_id) || component.component_alias;
  };

  // Si no hay componentes activos, no mostrar nada
  if (activeComponents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Tabs de componentes */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          {activeComponents.map((component) => (
            <TabsTrigger key={component.id} value={component.id} className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              {getComponentLabel(component)}
              {componentsData[component.id]?.isLoading && (
                <span className="ml-1 text-xs text-muted-foreground">...</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab General: Prompts del producto padre */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Prompts del padre */}
            {parentProduct?.prompts && (
              <PromptsForm
                product={parentProduct}
                values={parentPromptValues}
                onChange={onParentPromptChange}
                onCommit={onParentPromptCommit}
                showAllPrompts={isAdmin}
              />
            )}

            {/* Resumen de precios por componente */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Desglose de precios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeComponents.map((component) => {
                  const data = componentsData[component.id];
                  return (
                    <div key={component.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{getComponentLabel(component)}</span>
                      <span className="font-medium">
                        {data?.isLoading ? "..." : formatCurrency(data?.price ?? 0)}
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(totalPrice)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tabs de cada componente */}
        {activeComponents.map((component) => {
          const data = componentsData[component.id];
          
          // Separar outputs de texto e imágenes
          const textOutputs = (data?.outputs || []).filter((o: any) => {
            const value = String(o?.value ?? "");
            const type = String(o?.type || o?.outputType || "").toLowerCase();
            return !/^https?:\/\//i.test(value) && type !== "price";
          });

          const imageOutputs = (data?.outputs || []).filter((o: any) => {
            const value = String(o?.value ?? "");
            return /^https?:\/\//i.test(value);
          });

          // Procesar prompts para mostrar
          const displayPrompts = (data?.prompts || []).map((p: any) => ({
            id: p.id,
            label: p.promptText || p.label || p.name || "",
            value: p.currentValue ?? p.defaultValue ?? "",
          }));

          return (
            <TabsContent key={component.id} value={component.id} className="mt-4 space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Datos de entrada (prompts) - Solo lectura para componentes */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      Datos de entrada
                      <Badge variant="secondary" className="text-xs">Automático</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data?.isLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : displayPrompts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin parámetros configurados</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {displayPrompts.slice(0, 10).map((prompt: any, idx: number) => (
                          <div key={`${prompt.id}-${idx}`} className="flex justify-between">
                            <span className="text-muted-foreground">{prompt.label}</span>
                            <span className="font-medium">{String(prompt.value ?? "—")}</span>
                          </div>
                        ))}
                        {displayPrompts.length > 10 && (
                          <p className="text-xs text-muted-foreground pt-2">
                            +{displayPrompts.length - 10} más...
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Datos de salida (outputs) */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Resultados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data?.isLoading ? (
                      <p className="text-sm text-muted-foreground">Calculando...</p>
                    ) : (
                      <>
                        {/* Precio del componente */}
                        <div className="p-2 rounded-md bg-accent/10 flex justify-between">
                          <span className="font-medium">Precio</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(data?.price ?? 0)}
                          </span>
                        </div>

                        {/* Outputs de texto */}
                        {textOutputs.length > 0 && (
                          <div className="space-y-2 text-sm">
                            {textOutputs.map((output: any, index: number) => (
                              <div key={index} className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {output.label || output.name}
                                </span>
                                <span className="font-medium">{output.value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Imágenes */}
                        {imageOutputs.length > 0 && (
                          <div className="space-y-3 pt-2 border-t">
                            {imageOutputs.map((output: any, index: number) => (
                              <div key={`img-${index}`} className="space-y-1">
                                <p className="text-sm font-medium">{output.label || output.name}</p>
                                <img
                                  src={output.value}
                                  alt={output.label || output.name || `Imagen ${index + 1}`}
                                  className="w-full max-w-xs rounded border"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {textOutputs.length === 0 && imageOutputs.length === 0 && (
                          <p className="text-sm text-muted-foreground">Sin resultados</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
