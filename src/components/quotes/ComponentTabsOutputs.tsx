import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GENERAL_COMPONENT, useProductComponentSettings } from "@/hooks/useProductComponentSettings";

interface ComponentTabsOutputsProps {
  productId: string;
  outputs: any[];
  activeComponent?: string;
  onComponentChange?: (component: string) => void;
  renderOutput: (output: any, index: number) => React.ReactNode;
  renderPrice?: () => React.ReactNode;
  renderImages?: (images: any[]) => React.ReactNode;
  isLoading?: boolean;
}

// Labels para componentes
const COMPONENT_LABELS: Record<string, string> = {
  general: "General",
  cubierta: "Cubierta",
  interior_1: "Interior 1",
  interior_2: "Interior 2"
};

// Orden predefinido de componentes
const COMPONENT_ORDER = ["cubierta", "interior_1", "interior_2"];

export default function ComponentTabsOutputs({
  productId,
  outputs,
  activeComponent,
  onComponentChange,
  renderOutput,
  renderPrice,
  renderImages,
  isLoading: isLoadingProp = false
}: ComponentTabsOutputsProps) {
  const {
    isComposite,
    enabledComponents,
    getPromptComponent,
    isLoading: isLoadingSettings
  } = useProductComponentSettings(productId);

  const isLoadingData = isLoadingProp || isLoadingSettings;

  // Componentes disponibles ordenados
  const availableComponents = useMemo(() => {
    if (!isComposite) return [GENERAL_COMPONENT.value];
    
    const sortedEnabled = [...enabledComponents].sort((a, b) => {
      const indexA = COMPONENT_ORDER.indexOf(a);
      const indexB = COMPONENT_ORDER.indexOf(b);
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });
    
    return [GENERAL_COMPONENT.value, ...sortedEnabled];
  }, [enabledComponents, isComposite]);

  // Inferir componente desde el nombre de la hoja Excel
  const inferComponentFromSheet = (sheetName?: string): string => {
    if (!sheetName) return "general";
    const lower = String(sheetName).toLowerCase();

    // Mapeo directo por nombre
    if (lower.includes("cubierta") || lower.includes("cover")) return "cubierta";
    if (lower.includes("interior_2") || lower.includes("interior2")) return "interior_2";
    if (lower.includes("interior_1") || lower.includes("interior1") || lower.includes("interior")) return "interior_1";

    // Intentar inferir por número
    const match = lower.match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      const enabled = enabledComponents || [];
      if (Number.isFinite(n) && n >= 1 && n <= enabled.length) {
        return enabled[n - 1];
      }
      if (Number.isFinite(n) && n >= 1 && n <= availableComponents.length) {
        return availableComponents[n - 1];
      }
    }

    return "general";
  };

  // Agrupar outputs por componente
  const outputsByComponent = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    // Inicializar todos los componentes
    availableComponents.forEach(comp => {
      grouped[comp] = [];
    });

    for (const output of outputs) {
      // Usar nameCell, name, o label como identificador
      const identifier = output?.nameCell || output?.name_cell || output?.name || output?.label;
      const sheet = output?.sheet;
      let component = "general";
      
      // Buscar en asignaciones guardadas usando el identificador
      if (identifier) {
        const assigned = getPromptComponent(identifier);
        if (assigned !== "general") {
          component = assigned;
        } else if (sheet) {
          // Fallback: inferir por hoja
          component = inferComponentFromSheet(sheet);
        }
      } else if (sheet) {
        component = inferComponentFromSheet(sheet);
      }
      
      // Si el componente no está en los disponibles, poner en general
      if (!grouped[component]) {
        grouped[GENERAL_COMPONENT.value].push(output);
      } else {
        grouped[component].push(output);
      }
    }

    return grouped;
  }, [outputs, availableComponents, getPromptComponent, enabledComponents]);

  // Contar outputs por componente
  const countByComponent = useMemo(() => {
    const counts: Record<string, number> = {};
    availableComponents.forEach(comp => {
      counts[comp] = outputsByComponent[comp]?.length || 0;
    });
    return counts;
  }, [outputsByComponent, availableComponents]);

  // Componentes para pestañas (sin "general")
  const tabComponents = useMemo(() => 
    availableComponents.filter(c => c !== GENERAL_COMPONENT.value), 
    [availableComponents]
  );
  
  // Outputs generales
  const generalOutputs = useMemo(() => 
    outputsByComponent[GENERAL_COMPONENT.value] || [], 
    [outputsByComponent]
  );

  // Separar images de text outputs para outputs generales
  const generalImages = useMemo(() => 
    generalOutputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? ""))),
    [generalOutputs]
  );
  
  const generalTextOutputs = useMemo(() => 
    generalOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      const type = String(o?.type || "").toLowerCase();
      return !/^https?:\/\//i.test(value) && type !== "price";
    }),
    [generalOutputs]
  );

  // Estado del tab activo
  const initialTab = useMemo(() => {
    // Si hay activeComponent y es válido, usarlo
    if (activeComponent && tabComponents.includes(activeComponent)) {
      return activeComponent;
    }
    // Buscar el primer tab con outputs
    for (const comp of tabComponents) {
      if ((countByComponent[comp] || 0) > 0) return comp;
    }
    return tabComponents[0] || "";
  }, [tabComponents, countByComponent, activeComponent]);

  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Sincronizar con el componente activo del padre (prompts)
  useEffect(() => {
    if (activeComponent && tabComponents.includes(activeComponent)) {
      setActiveTab(activeComponent);
    }
  }, [activeComponent, tabComponents]);

  // Notificar cambio de componente
  useEffect(() => {
    if (onComponentChange && activeTab) {
      onComponentChange(activeTab);
    }
  }, [activeTab, onComponentChange]);

  // Mantener activeTab válido
  useEffect(() => {
    if (!tabComponents.length) return;
    if (!activeTab || !tabComponents.includes(activeTab)) {
      setActiveTab(initialTab);
    }
  }, [activeTab, tabComponents, initialTab]);

  // Obtener outputs del componente seleccionado
  const selectedComponentOutputs = useMemo(() => {
    if (activeTab === "general") return [];
    return outputsByComponent[activeTab] || [];
  }, [outputsByComponent, activeTab]);

  const selectedImages = useMemo(() => 
    selectedComponentOutputs.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? ""))),
    [selectedComponentOutputs]
  );
  
  const selectedTextOutputs = useMemo(() => 
    selectedComponentOutputs.filter((o: any) => {
      const value = String(o?.value ?? "");
      const type = String(o?.type || "").toLowerCase();
      return !/^https?:\/\//i.test(value) && type !== "price";
    }),
    [selectedComponentOutputs]
  );

  // Si está cargando, mostrar indicador
  if (isLoadingData) {
    return (
      <div className="space-y-4">
        {renderPrice && renderPrice()}
        <div className="flex items-center justify-center py-4">
          <span className="text-sm text-muted-foreground animate-pulse">Calculando resultados...</span>
        </div>
      </div>
    );
  }

  // Si NO es compuesto o no hay tabs, mostrar outputs planos
  if (!isComposite || tabComponents.length === 0) {
    return (
      <div className="space-y-4">
        {renderPrice && renderPrice()}
        {renderImages && generalImages.length > 0 && renderImages(generalImages)}
        {generalTextOutputs.length > 0 && (
          <section className="space-y-2">
            {generalTextOutputs.map((o, idx) => renderOutput(o, idx))}
          </section>
        )}
      </div>
    );
  }

  // Producto compuesto: mostrar con pestañas
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        {tabComponents.map(comp => {
          const count = countByComponent[comp];
          const label = COMPONENT_LABELS[comp] || comp;
          return (
            <TabsTrigger 
              key={comp} 
              value={comp} 
              className="relative flex items-center text-xs" 
            >
              {label}
              {count > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({count})</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Precio siempre visible arriba */}
      {renderPrice && renderPrice()}

      {/* Contenido de cada tab - muestra solo los outputs de ese componente */}
      {tabComponents.map(comp => {
        const componentOutputs = outputsByComponent[comp] || [];
        // Añadir también los outputs generales al componente activo
        const allOutputsForComponent = comp === activeTab 
          ? [...(outputsByComponent[GENERAL_COMPONENT.value] || []), ...componentOutputs]
          : componentOutputs;
        
        const componentImages = allOutputsForComponent.filter((o: any) => /^https?:\/\//i.test(String(o?.value ?? "")));
        const componentTextOutputs = allOutputsForComponent.filter((o: any) => {
          const value = String(o?.value ?? "");
          const type = String(o?.type || "").toLowerCase();
          return !/^https?:\/\//i.test(value) && type !== "price";
        });

        return (
          <TabsContent key={comp} value={comp} className="mt-0 space-y-3">
            {renderImages && componentImages.length > 0 && renderImages(componentImages)}
            {componentTextOutputs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hay resultados para {COMPONENT_LABELS[comp] || comp}.
              </p>
            ) : (
              <section className="space-y-2">
                {componentTextOutputs.map((o, idx) => renderOutput(o, idx))}
              </section>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
