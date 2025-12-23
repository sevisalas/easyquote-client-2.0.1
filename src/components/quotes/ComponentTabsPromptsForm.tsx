import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import PromptsForm, { extractPrompts, type PromptDef } from "./PromptsForm";
import { useProductComponentSettings, COMPONENT_PRESETS, GENERAL_COMPONENT } from "@/hooks/useProductComponentSettings";

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
  'general': 'General',
  'cubierta': 'Cubierta',
  'interior_1': 'Interior 1',
  'interior_2': 'Interior 2',
};

export default function ComponentTabsPromptsForm({
  product,
  productId,
  values,
  onChange,
  onCommit,
  showAllPrompts = false,
}: ComponentTabsPromptsFormProps) {
  const {
    isComposite,
    enabledComponents,
    getPromptComponent,
    isLoading,
  } = useProductComponentSettings(productId);

  const prompts = useMemo(() => extractPrompts(product), [product]);
  
  // Si NO es un producto compuesto, renderizar el formulario normal
  if (!isComposite || isLoading) {
    return (
      <PromptsForm
        product={product}
        values={values}
        onChange={onChange}
        onCommit={onCommit}
        showAllPrompts={showAllPrompts}
      />
    );
  }

  // Construir lista de componentes disponibles: siempre "general" + los habilitados
  const availableComponents = useMemo(() => {
    const components = [GENERAL_COMPONENT.value, ...enabledComponents];
    // Eliminar duplicados manteniendo el orden
    return [...new Set(components)];
  }, [enabledComponents]);

  // Agrupar prompts por componente
  const promptsByComponent = useMemo(() => {
    const grouped: Record<string, PromptDef[]> = {};
    
    // Inicializar todos los componentes
    availableComponents.forEach(comp => {
      grouped[comp] = [];
    });

    // Obtener los prompts originales del producto para acceder a promptCell
    const originalPrompts = product?.prompts || [];

    // Asignar cada prompt a su componente
    prompts.forEach((prompt) => {
      // Buscar el prompt original para obtener el promptCell (que es lo que se guarda en DB)
      const originalPrompt = originalPrompts.find((op: any) => 
        String(op.id) === String(prompt.id) || 
        String(op.promptCell) === String(prompt.id) ||
        String(op.key) === String(prompt.id)
      );
      
      // El nombre guardado en la DB es promptCell, no el id
      const promptIdentifier = originalPrompt?.promptCell || originalPrompt?.id || prompt.id;
      const component = getPromptComponent(promptIdentifier);
      
      // Si el componente asignado existe en los disponibles, usarlo; sino, poner en general
      if (grouped[component]) {
        grouped[component].push(prompt);
      } else {
        grouped['general'].push(prompt);
      }
    });

    return grouped;
  }, [prompts, availableComponents, getPromptComponent, product]);

  // Contar prompts por componente para mostrar badge
  const countByComponent = useMemo(() => {
    const counts: Record<string, number> = {};
    availableComponents.forEach(comp => {
      counts[comp] = promptsByComponent[comp]?.length || 0;
    });
    return counts;
  }, [promptsByComponent, availableComponents]);

  // Encontrar el primer tab con prompts
  const defaultTab = useMemo(() => {
    for (const comp of availableComponents) {
      if (countByComponent[comp] > 0) {
        return comp;
      }
    }
    return 'general';
  }, [availableComponents, countByComponent]);

  // Crear un "producto virtual" para cada componente con solo sus prompts
  const createComponentProduct = (componentPrompts: PromptDef[]) => {
    return {
      ...product,
      prompts: componentPrompts.map(p => {
        // Buscar el prompt original en product.prompts para preservar toda la metadata
        const original = (product?.prompts || []).find((op: any) => 
          (op.id === p.id) || (op.promptCell === p.id) || (op.key === p.id)
        );
        return original || p;
      }),
    };
  };

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="mb-4 flex-wrap h-auto gap-1">
        {availableComponents.map((comp) => {
          const count = countByComponent[comp];
          const label = COMPONENT_LABELS[comp] || comp;
          
          return (
            <TabsTrigger 
              key={comp} 
              value={comp}
              className="relative flex items-center gap-2"
              disabled={count === 0}
            >
              {label}
              {count > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {availableComponents.map((comp) => {
        const componentPrompts = promptsByComponent[comp] || [];
        
        return (
          <TabsContent key={comp} value={comp} className="mt-0">
            {componentPrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No hay campos de entrada asignados a {COMPONENT_LABELS[comp] || comp}.
              </p>
            ) : (
              <PromptsForm
                product={createComponentProduct(componentPrompts)}
                values={values}
                onChange={onChange}
                onCommit={onCommit}
                showAllPrompts={showAllPrompts}
              />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
