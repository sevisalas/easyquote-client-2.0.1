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
