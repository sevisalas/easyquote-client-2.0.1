## Objetivo

Que cada organización pueda personalizar **etiqueta** y **color** de los 5 estados del flujo, válidos tanto para el **pedido** como para el **trabajo (item)**. Renombrar "En producción" → "En curso" por defecto.

## Estados (claves fijas, etiqueta/color editables)

| key (BD, no se toca) | label por defecto | color por defecto |
|---|---|---|
| `draft` | Borrador | gris |
| `pending` | Pendiente | naranja |
| `in_progress` *(pedido: `in_production`)* | En curso | azul |
| `completed` | Terminado | verde |
| `cancelled` | Cancelado | rojo |

Las **claves en BD se mantienen** (`sales_orders.status` sigue usando `in_production`, `sales_order_items.production_status` sigue usando `in_progress`). Solo se mapean a un único concepto visual "En curso".

## Modelo de datos

Nueva tabla `organization_status_settings`:
- `organization_id` (FK, único + status_key)
- `status_key` text (`draft|pending|in_progress|completed|cancelled`)
- `label` text
- `color` text (hex)
- `display_order` int

RLS: lectura cualquier miembro de la organización, escritura solo Admin/Gestor. Si no hay fila, frontend usa defaults.

## UI

**Nueva pestaña "Estados" en `/configuracion/produccion`** (junto a Fases, Tareas, Recursos). Es donde el usuario espera tocar estética de producción y queda agrupado con Fases (mismo paradigma: lista editable con color picker).

Por estado: input de etiqueta + color picker + restore-default. No se puede crear/borrar (claves fijas). Preview en vivo de badge.

## Cambios de código (frontend)

- **Hook nuevo** `useStatusSettings()` con React Query (key `["status-settings", orgId]`). Devuelve mapa `{ key → {label, color} }` con fallback a defaults.
- **Refactor `src/lib/statusColors.ts`**: pasa a exportar solo defaults + helper `getStatusStyle(key, settings)` que resuelve color/label dinámicamente.
- **Sustituir usos hardcoded** de colores/labels de estado en:
  - `src/pages/SalesOrderDetail.tsx` (barra de progreso pedido + items, selector de estado)
  - `src/pages/ProductionBoard.tsx` (badges y `PhaseIndicator`)
  - `src/pages/SalesOrdersList.tsx`, `src/components/sales/SalesOrderCard.tsx`
  - `src/pages/ProductionBoardKanban.tsx`, `ProductionBoardCompact.tsx`
  - Selectores de estado (mostrar la `label` del usuario en `SelectItem`)
- **Mapping pedido ↔ trabajo**: `in_production` (pedido) y `in_progress` (item/tarea) leen la misma config con clave lógica `in_progress`. Helper `normalizeStatusKey()`.

## Lo que NO cambia

- Enum/strings en BD (`sales_orders.status`, `production_status`, `production_tasks.status`).
- Lógica de aprobación, Holded, sincronización de estados.
- Fases de producción (ya son configurables, otra cosa).

## Pasos de implementación

1. Migración: tabla `organization_status_settings` + RLS + trigger updated_at.
2. Hook `useStatusSettings` + refactor `statusColors.ts` con helper resolutivo.
3. Pestaña "Estados" en `ProductionConfiguration.tsx` con form de 5 filas.
4. Reemplazar usos hardcoded en las páginas listadas.
5. Verificar barra de progreso del pedido, badges en listas y kanban con la nueva config.
