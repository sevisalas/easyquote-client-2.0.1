import { Label } from "@/components/ui/label";
import { BookOpen, ChevronDown, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Tipos de configuración de producto encuadernado
export type BoundProductConfig = "same_paper" | "cover_1_interior" | "cover_2_interiors";

// Definición de las opciones de configuración
export const BOUND_CONFIG_OPTIONS: Record<BoundProductConfig, {
  label: string;
  description: string;
  components: string[];
}> = {
  same_paper: {
    label: "Mismo papel cubierta e interior",
    description: "Un solo tipo de papel para todo el producto",
    components: ["interior_1"],
  },
  cover_1_interior: {
    label: "Cubierta + Interior (diferentes)",
    description: "Papel diferente para cubierta e interior",
    components: ["cubierta", "interior_1"],
  },
  cover_2_interiors: {
    label: "Cubierta + 2 Interiores",
    description: "Cubierta y dos tipos de interiores diferentes",
    components: ["cubierta", "interior_1", "interior_2"],
  },
};

interface BoundProductConfigSelectorProps {
  /** Componentes habilitados para este producto */
  enabledComponents: string[];
  /** Configuración actual seleccionada */
  value: BoundProductConfig | null;
  /** Callback cuando cambia la configuración */
  onChange: (config: BoundProductConfig) => void;
}

/**
 * Determina qué opciones de configuración mostrar según los componentes habilitados.
 * 
 * - Si tiene 3 componentes (cubierta + interior_1 + interior_2): muestra las 3 opciones
 * - Si tiene 2 componentes (cubierta + interior_1): muestra 2 opciones (same_paper, cover_1_interior)
 * - Si solo tiene interior_1: no se muestra el selector (retorna array vacío)
 */
export function getAvailableConfigs(enabledComponents: string[]): BoundProductConfig[] {
  const hasCubierta = enabledComponents.includes("cubierta");
  const hasInterior1 = enabledComponents.includes("interior_1");
  const hasInterior2 = enabledComponents.includes("interior_2");

  // Caso 1: Tiene los 3 componentes → 3 opciones
  if (hasCubierta && hasInterior1 && hasInterior2) {
    return ["same_paper", "cover_1_interior", "cover_2_interiors"];
  }

  // Caso 2: Tiene cubierta + interior_1 → 2 opciones
  if (hasCubierta && hasInterior1) {
    return ["same_paper", "cover_1_interior"];
  }

  // Caso 3: Solo interior_1 u otras combinaciones → sin selector
  return [];
}

/**
 * Retorna los componentes activos según la configuración seleccionada.
 * Siempre incluye "general" ya que los prompts generales siempre se muestran.
 */
export function getActiveComponents(config: BoundProductConfig | null): string[] {
  if (!config) return ["general"];
  
  const configComponents = BOUND_CONFIG_OPTIONS[config]?.components || [];
  return ["general", ...configComponents];
}

export default function BoundProductConfigSelector({
  enabledComponents,
  value,
  onChange,
}: BoundProductConfigSelectorProps) {
  const availableConfigs = getAvailableConfigs(enabledComponents);

  // Si no hay opciones disponibles (solo tiene interior_1), no mostrar nada
  if (availableConfigs.length === 0) {
    return null;
  }

  return (
    <Select
      value={value || ""}
      onValueChange={(val) => onChange(val as BoundProductConfig)}
    >
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
          <SelectValue placeholder="Selecciona configuración..." />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover">
        {availableConfigs.map((configKey) => {
          const config = BOUND_CONFIG_OPTIONS[configKey];
          return (
            <SelectItem key={configKey} value={configKey}>
              <div className="flex flex-col">
                <span className="font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">{config.description}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
