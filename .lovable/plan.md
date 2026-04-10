

## Plan: Sincronización automática estado pedido ↔ artículos

### Situación actual
- Ya existe validación que **bloquea** completar un pedido si hay artículos sin terminar (líneas 604-610 de `SalesOrderDetail.tsx`).
- El cambio de estado de artículos ocurre en `ItemProductionCard.tsx` → `handleStatusChange`, que llama a `onStatusUpdate` callback tras actualizar.
- El cambio de estado del pedido ocurre en `SalesOrderDetail.tsx` → `handleStatusChange`.

### Cambios necesarios

#### 1. `ItemProductionCard.tsx` — Propagar info del nuevo estado
- Modificar `onStatusUpdate` callback para pasar el `itemId` y `newStatus` al padre, permitiendo que el padre reaccione al cambio.

#### 2. `SalesOrderDetail.tsx` — Lógica de auto-sincronización
Cuando un artículo cambia de estado (callback desde `ItemProductionCard`):

- **Si algún artículo pasa a `in_progress`** → si el pedido está en `draft` o `pending`, cambiarlo automáticamente a `in_production`.
- **Cuando todos los artículos están en `completed`** → cambiar el pedido automáticamente a `completed`.
- **Si se "des-completa" un artículo** (vuelve a `in_progress` o `pending`) → si el pedido estaba en `completed`, regresarlo a `in_production`.

#### 3. `SalesOrderDetail.tsx` — Bloqueo en selector manual
- Mantener la validación existente que impide completar manualmente si hay artículos pendientes (ya existe).
- Opcionalmente mostrar un aviso si el usuario intenta cambiar manualmente a un estado inconsistente con los artículos.

### Archivos a modificar
- `src/components/production/ItemProductionCard.tsx` — ampliar callback
- `src/pages/SalesOrderDetail.tsx` — añadir lógica de auto-sync tras cambio de artículo

No se requieren cambios de base de datos; toda la lógica es client-side tras las actualizaciones existentes a `sales_order_items`.

