/**
 * Paleta única de colores de estado.
 * Cualquier UI que muestre estados (presupuestos, pedidos, fases, tareas)
 * DEBE usar este módulo. No introducir colores ad-hoc.
 */

export type UnifiedStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type ConfigurableStatusKey = Exclude<UnifiedStatus, "paused">;

export const STATUS_COLORS: Record<
  UnifiedStatus,
  { bg: string; border: string; text: string; tw: string; label: string }
> = {
  // Borrador → gris
  draft: {
    bg: "hsl(220 13% 85%)",
    border: "hsl(220 13% 65%)",
    text: "hsl(220 9% 25%)",
    tw: "bg-slate-400",
    label: "Borrador",
  },
  // Pendiente → naranja
  pending: {
    bg: "hsl(25 95% 80%)",
    border: "hsl(25 95% 50%)",
    text: "hsl(25 95% 20%)",
    tw: "bg-orange-500",
    label: "Pendiente",
  },
  // En curso / En producción → azul
  in_progress: {
    bg: "hsl(217 91% 60%)",
    border: "hsl(217 91% 50%)",
    text: "white",
    tw: "bg-blue-500",
    label: "En curso",
  },
  // Pausada → ámbar
  paused: {
    bg: "hsl(38 92% 80%)",
    border: "hsl(38 92% 50%)",
    text: "hsl(38 92% 20%)",
    tw: "bg-amber-500",
    label: "Pausada",
  },
  // Completado / Terminado → verde
  completed: {
    bg: "hsl(142 65% 75%)",
    border: "hsl(142 65% 40%)",
    text: "hsl(142 70% 15%)",
    tw: "bg-green-500",
    label: "Completado",
  },
  // Cancelado → rojo apagado
  cancelled: {
    bg: "hsl(0 60% 88%)",
    border: "hsl(0 70% 50%)",
    text: "hsl(0 70% 25%)",
    tw: "bg-red-500",
    label: "Cancelado",
  },
};

/** Mapeo de estados de pedido (BD) a estado unificado. */
export const ORDER_STATUS_TO_UNIFIED: Record<string, UnifiedStatus> = {
  draft: "draft",
  pending: "pending",
  in_production: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

/** Hex por defecto para el color picker del panel de configuración. */
export const DEFAULT_STATUS_HEX: Record<ConfigurableStatusKey, string> = {
  draft: "#94a3b8",      // slate-400
  pending: "#f97316",    // orange-500
  in_progress: "#3b82f6",// blue-500
  completed: "#22c55e",  // green-500
  cancelled: "#ef4444",  // red-500
};

export const DEFAULT_STATUS_LABEL: Record<ConfigurableStatusKey, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Terminado",
  cancelled: "Cancelado",
};

/** Convierte HEX → estilo de badge derivado (bg suave + borde + texto oscuro). */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").trim();
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

export function styleFromHex(hex: string) {
  const rgb = hexToRgb(hex) || { r: 100, g: 100, b: 100 };
  return {
    bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`,
    border: hex,
    text: hex,
    solid: hex,
  };
}

/**
 * Normaliza una clave de estado (pedido o item/tarea) al conjunto configurable.
 * - in_production (pedido) → in_progress
 * - paused (tarea) → in_progress visualmente
 */
export function normalizeStatusKey(raw: string | null | undefined): ConfigurableStatusKey {
  if (!raw) return "pending";
  if (raw === "in_production" || raw === "paused") return "in_progress";
  if (["draft", "pending", "in_progress", "completed", "cancelled"].includes(raw)) {
    return raw as ConfigurableStatusKey;
  }
  return "pending";
}
