import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Package } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompositeComponent } from "@/hooks/useCompositeProductConfig";

export interface ActiveComponent {
  id: string; // composite_product_components.id
  component_product_id: string;
  component_alias: string;
  display_order: number;
  is_optional: boolean;
  /** Instancia añadida por el usuario (para múltiples del mismo tipo opcional) */
  instance_index?: number;
}

export function getActiveComponentKey(component: ActiveComponent): string {
  const idx = component.instance_index ?? 1;
  return `${component.id}:${idx}`;
}

interface CompositeComponentsSelectorProps {
  /** Componentes configurados para este producto compuesto */
  configuredComponents: CompositeComponent[];
  /** Componentes actualmente activos (obligatorios + opcionales añadidos) */
  activeComponents: ActiveComponent[];
  /** Callback cuando cambian los componentes activos */
  onActiveComponentsChange: (components: ActiveComponent[]) => void;
  /** Map de product_id -> nombre del producto */
  productNames?: Map<string, string>;
  /** Mostrar en modo compacto */
  compact?: boolean;
}

/**
 * Selector de componentes para productos compuestos.
 * 
 * - Muestra automáticamente los componentes obligatorios (is_optional=false)
 * - Permite añadir/quitar componentes opcionales (is_optional=true)
 * - Soporta múltiples instancias del mismo componente opcional
 */
export default function CompositeComponentsSelector({
  configuredComponents,
  activeComponents,
  onActiveComponentsChange,
  productNames = new Map(),
  compact = false,
}: CompositeComponentsSelectorProps) {
  const getInstanceIndex = (c: ActiveComponent) => c.instance_index ?? 1;

  // Separar componentes obligatorios y opcionales
  const { requiredComponents, optionalComponents } = useMemo(() => {
    const required = configuredComponents.filter(c => !c.is_optional);
    const optional = configuredComponents.filter(c => c.is_optional);
    return { requiredComponents: required, optionalComponents: optional };
  }, [configuredComponents]);

  // Inicializar con componentes obligatorios si no hay activos
  useEffect(() => {
    if (activeComponents.length === 0 && requiredComponents.length > 0) {
      const initial: ActiveComponent[] = requiredComponents.map(c => ({
        id: c.id,
        component_product_id: c.component_product_id,
        component_alias: c.component_alias,
        display_order: c.display_order,
        is_optional: false,
        instance_index: 1,
      }));
      onActiveComponentsChange(initial);
    }
  }, [requiredComponents, activeComponents.length, onActiveComponentsChange]);

  const getNextInstanceIndex = useCallback(
    (componentConfigId: string) => {
      const indices = activeComponents
        .filter((a) => a.id === componentConfigId)
        .map((a) => getInstanceIndex(a));
      if (indices.length === 0) return 1;
      return Math.max(...indices) + 1;
    },
    [activeComponents]
  );

  const handleAddComponentInstance = (componentConfigId: string) => {
    const component = configuredComponents.find((c) => c.id === componentConfigId);
    if (!component) return;

    const nextIndex = getNextInstanceIndex(component.id);
    const baseLabel = productNames.get(component.component_product_id) || component.component_alias;

    const newActive: ActiveComponent = {
      id: component.id,
      component_product_id: component.component_product_id,
      component_alias: baseLabel,
      display_order: component.display_order,
      // La primera instancia de un obligatorio es no-removible. Cualquier instancia extra es removible.
      is_optional: component.is_optional ? true : nextIndex > 1,
      instance_index: nextIndex,
    };

    const updated = [...activeComponents, newActive].sort((a, b) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return getInstanceIndex(a) - getInstanceIndex(b);
    });
    onActiveComponentsChange(updated);
  };

  const handleRemoveInstance = (componentConfigId: string, instanceIndex: number) => {
    const updated = activeComponents.filter(
      (a) => !(a.id === componentConfigId && getInstanceIndex(a) === instanceIndex)
    );
    onActiveComponentsChange(updated);
  };

  const instanceCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of activeComponents) {
      map.set(c.id, (map.get(c.id) ?? 0) + 1);
    }
    return map;
  }, [activeComponents]);

  const getComponentLabel = (component: ActiveComponent) => {
    const productName = productNames.get(component.component_product_id);
    const base = productName || component.component_alias;
    const count = instanceCountById.get(component.id) ?? 0;
    const idx = getInstanceIndex(component);
    // Solo mostramos sufijo si hay más de una instancia.
    return count > 1 ? `${base} ${idx}` : base;
  };

  // Si no hay componentes configurados, no mostrar nada
  if (configuredComponents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Componentes activos */}
      <div className="flex flex-wrap gap-2">
        {activeComponents.map(component => (
          <Badge
            key={getActiveComponentKey(component)}
            variant={component.is_optional ? "outline" : "secondary"}
            className="gap-1 pr-1"
          >
            <Package className="h-3 w-3" />
            {getComponentLabel(component)}
            {component.is_optional && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:bg-destructive/20"
                onClick={() => handleRemoveInstance(component.id, getInstanceIndex(component))}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        ))}

        {/* Selector para añadir instancias (permite añadir el mismo componente varias veces) */}
        {!compact && configuredComponents.length > 0 && (
          <Select onValueChange={handleAddComponentInstance}>
            <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
              <Plus className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Añadir componente" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {configuredComponents.map((component) => (
                <SelectItem key={component.id} value={component.id}>
                  {productNames.get(component.component_product_id) || component.component_alias}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Info de componentes obligatorios vs opcionales */}
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {requiredComponents.length > 0 && (
            <span>{requiredComponents.length} obligatorio{requiredComponents.length > 1 ? 's' : ''}</span>
          )}
          {requiredComponents.length > 0 && optionalComponents.length > 0 && ' · '}
          {optionalComponents.length > 0 && (
            <span>{optionalComponents.length} opcional{optionalComponents.length > 1 ? 'es' : ''}</span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Hook para determinar los componentes activos iniciales basándose en la configuración.
 * Retorna los obligatorios como activos por defecto.
 */
export function getInitialActiveComponents(
  configuredComponents: CompositeComponent[]
): ActiveComponent[] {
  return configuredComponents
    .filter(c => !c.is_optional)
    .map(c => ({
      id: c.id,
      component_product_id: c.component_product_id,
      component_alias: c.component_alias,
      display_order: c.display_order,
      is_optional: false,
      instance_index: 1,
    }))
    .sort((a, b) => a.display_order - b.display_order);
}

/**
 * Determina si el producto compuesto está listo para mostrar prompts/outputs.
 * Retorna true si hay al menos un componente obligatorio configurado.
 */
export function hasRequiredComponents(
  configuredComponents: CompositeComponent[]
): boolean {
  return configuredComponents.some(c => !c.is_optional);
}
