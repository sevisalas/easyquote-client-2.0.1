import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromptsForm, { extractPrompts, type PromptDef } from "./PromptsForm";
import { GENERAL_COMPONENT, useProductComponentSettings } from "@/hooks/useProductComponentSettings";
import { getEasyQuoteToken, invokeEasyQuoteFunction } from "@/lib/easyquoteApi";
interface ComponentTabsPromptsFormProps {
  product: any;
  productId: string;
  values: Record<string, any>;
  onChange: (id: string, value: any, label: string) => void;
  onCommit?: (id: string, value: any, label: string) => void;
  showAllPrompts?: boolean;
}

// Labels para componentes
const COMPONENT_LABELS: Record<string, string> = {
  general: "General",
  cubierta: "Cubierta",
  interior_1: "Interior 1",
  interior_2: "Interior 2"
};
function getPromptCell(op: any): string | undefined {
  return op?.promptCell ?? op?.prompt_cell ?? op?.cell ?? op?.promptcell;
}
function normalizePromptName(v: any): string {
  return String(v ?? "").replace(/\$/g, "").trim().toUpperCase();
}
export default function ComponentTabsPromptsForm({
  product,
  productId,
  values,
  onChange,
  onCommit,
  showAllPrompts = false
}: ComponentTabsPromptsFormProps) {
  const {
    isComposite,
    enabledComponents,
    getPromptComponent,
    isLoading
  } = useProductComponentSettings(productId);
  const prompts = useMemo(() => extractPrompts(product), [product]);
  const {
    data: promptDefinitions = []
  } = useQuery({
    queryKey: ["easyquote-prompts-definitions", productId],
    queryFn: async () => {
      if (!productId) return [];
      const token = await getEasyQuoteToken();
      if (!token) return [];
      const {
        data,
        error
      } = await invokeEasyQuoteFunction<any[]>("easyquote-prompts", {
        token,
        productId
      });
      if (error) {
        console.error("[ComponentTabsPromptsForm] Error fetching prompt definitions", error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: isComposite && !!productId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  const promptCellById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of promptDefinitions as any[]) {
      const id = p?.id;
      const cell = getPromptCell(p);
      if (id && cell) map.set(String(id), normalizePromptName(cell));
    }
    return map;
  }, [promptDefinitions]);

  // Construir lista de componentes disponibles: siempre "general" + los habilitados
  const availableComponents = useMemo(() => {
    const base = isComposite ? [GENERAL_COMPONENT.value, ...enabledComponents] : [GENERAL_COMPONENT.value];
    // Eliminar duplicados manteniendo el orden
    return [...new Set(base)];
  }, [enabledComponents, isComposite]);

  // Agrupar prompts por componente
  const promptsByComponent = useMemo(() => {
    const grouped: Record<string, PromptDef[]> = {};

    // Inicializar todos los componentes
    availableComponents.forEach(comp => {
      grouped[comp] = [];
    });

    // Obtener los prompts originales del producto para acceder a promptCell
    // Nota: en QuoteItem/ProductTestPage el objeto "pricing" NO trae promptCell.
    // Para poder mapear id(UUID) -> promptCell, usamos promptDefinitions (easyquote-prompts).
    const originalPrompts: any[] = Array.isArray(promptDefinitions) && promptDefinitions as any[] || Array.isArray(product?.prompts) && product.prompts || Array.isArray(product?.pricing?.prompts) && product.pricing.prompts || [];

    // Asignar cada prompt a su componente
    prompts.forEach(prompt => {
      const idStr = String(prompt.id);
      const promptCellFromDefs = promptCellById.get(idStr);

      // Buscar el prompt original (si existe) para extraer más metadata
      const originalPrompt = originalPrompts.find((op: any) => [op?.id, getPromptCell(op), op?.key, op?.name, op?.code].filter(Boolean).map(String).includes(idStr));
      const promptIdentifierRaw = promptCellFromDefs || getPromptCell(originalPrompt) || originalPrompt?.key || originalPrompt?.id || prompt.id;
      const promptIdentifier = normalizePromptName(promptIdentifierRaw) || idStr;
      const component = getPromptComponent(promptIdentifier);

      // Si el componente asignado existe en los disponibles, usarlo; sino, poner en general
      if (grouped[component]) {
        grouped[component].push(prompt);
      } else {
        grouped[GENERAL_COMPONENT.value].push(prompt);
      }
    });
    return grouped;
  }, [prompts, availableComponents, getPromptComponent, product]);

  // Contar prompts por componente (solo para habilitar/deshabilitar tabs)
  const countByComponent = useMemo(() => {
    const counts: Record<string, number> = {};
    availableComponents.forEach(comp => {
      counts[comp] = promptsByComponent[comp]?.length || 0;
    });
    return counts;
  }, [promptsByComponent, availableComponents]);

  // Crear un "producto virtual" para cada componente con solo sus prompts
  const createComponentProduct = (componentPrompts: PromptDef[]) => {
    return {
      ...product,
      prompts: componentPrompts.map(p => {
        // Buscar el prompt original en product.prompts para preservar toda la metadata
        const original = (product?.prompts || []).find((op: any) => [op?.id, getPromptCell(op), op?.key, op?.name, op?.code].filter(Boolean).map(String).includes(String(p.id)));
        return original || p;
      })
    };
  };

  // Componentes para pestañas (sin "general") y prompts generales
  const tabComponents = useMemo(() => availableComponents.filter(c => c !== GENERAL_COMPONENT.value), [availableComponents]);
  const generalPrompts = useMemo(() => promptsByComponent[GENERAL_COMPONENT.value] || [], [promptsByComponent]);
  const initialTab = useMemo(() => {
    for (const comp of tabComponents) {
      if ((countByComponent[comp] || 0) > 0) return comp;
    }
    return tabComponents[0] || "";
  }, [tabComponents, countByComponent]);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Mantener activeTab válido cuando cambien componentes o conteos
  useEffect(() => {
    if (!tabComponents.length) return;
    if (!activeTab || !tabComponents.includes(activeTab)) {
      setActiveTab(initialTab);
    }
  }, [activeTab, tabComponents, initialTab]);

  // Si NO es un producto compuesto (o está cargando), renderizar el formulario normal
  // (pero aseguramos que los hooks se llamen siempre para evitar "Rendered more hooks")
  if (!isComposite || isLoading) {
    return <PromptsForm product={product} values={values} onChange={onChange} onCommit={onCommit} showAllPrompts={showAllPrompts} />;
  }

  // Si no hay componentes (solo general), mostramos el título y el formulario general a ancho completo
  if (tabComponents.length === 0) {
    return <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-medium whitespace-nowrap">Configuración del Producto</h3>
        </div>
        {generalPrompts.length > 0 && <PromptsForm product={createComponentProduct(generalPrompts)} values={values} onChange={onChange} onCommit={onCommit} showAllPrompts={showAllPrompts} />}
      </div>;
  }
  return <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
      {/* Header con título y pestañas a la misma altura */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h3 className="font-medium whitespace-nowrap">Configuración del producto</h3>

        <TabsList className="flex-wrap h-auto gap-1 md:w-auto">
          {tabComponents.map(comp => {
          const count = countByComponent[comp];
          const label = COMPONENT_LABELS[comp] || comp;
          return <TabsTrigger key={comp} value={comp} className="relative flex items-center" disabled={count === 0}>
                {label}
              </TabsTrigger>;
        })}
        </TabsList>
      </div>

      {/* Contenido: dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna izquierda: General (siempre visible) */}
        {generalPrompts.length > 0 && <div className="rounded-lg border border-border bg-card p-4">
            <PromptsForm product={createComponentProduct(generalPrompts)} values={values} onChange={onChange} onCommit={onCommit} showAllPrompts={showAllPrompts} />
          </div>}

        {/* Columna derecha: Componentes con contenido de pestañas */}
        <div className="rounded-lg border border-border bg-card p-4">
          {tabComponents.map(comp => {
          const componentPrompts = promptsByComponent[comp] || [];
          return <TabsContent key={comp} value={comp} className="mt-0">
                {componentPrompts.length === 0 ? <p className="text-sm text-muted-foreground py-4">
                    No hay campos asignados a {COMPONENT_LABELS[comp] || comp}.
                  </p> : <PromptsForm product={createComponentProduct(componentPrompts)} values={values} onChange={onChange} onCommit={onCommit} showAllPrompts={showAllPrompts} />}
              </TabsContent>;
        })}
        </div>
      </div>
    </Tabs>;
}