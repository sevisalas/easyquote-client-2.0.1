## Objetivo

Cuando el usuario intente marcar un pedido como **Completado** y existan artículos o tareas de producción pendientes, mostrar un diálogo de aviso que:

1. Liste cuántos artículos y/o tareas quedan sin terminar.
2. Permita elegir entre:
   - **Cancelar** (no cerrar el pedido).
   - **Cerrar todo y completar el pedido** (marca como `completed` todos los artículos y todas sus tareas pendientes/en curso/pausadas, y después el pedido).

Hoy mismo (línea 606-613 de `src/pages/SalesOrderDetail.tsx`) la app bloquea el cierre con un toast de error. Lo sustituiremos por este flujo.

## Alcance

Cambios sólo de UI/flujo en `SalesOrderDetail.tsx`. No se tocan reglas de negocio de Holded, ni RLS, ni cálculo de precios.

## Cambios

### 1. `src/pages/SalesOrderDetail.tsx`

- Reemplazar el bloque actual de validación en `handleStatusChange` (cuando `newStatus === 'completed'`):
  - Calcular `incompleteItems` = artículos con `production_status !== 'completed'` (excluyendo cancelados si aplica).
  - Consultar a `production_tasks` por todos los `sales_order_item_id` del pedido las tareas con `status IN ('pending','in_progress','paused')`.
  - Si hay artículos o tareas pendientes → abrir un nuevo `AlertDialog` (estado `showForceCompleteDialog`) en lugar del `toast.error`.
  - Si no hay nada pendiente → flujo actual (marcar pedido completado).

- Nuevo `AlertDialog` ("¿Cerrar pedido con trabajos pendientes?"):
  - Texto de aviso explícito:  
    *"Hay X artículo(s) y Y tarea(s) de producción sin terminar. Si continúas, todos ellos se marcarán como **Terminados** automáticamente. Esta acción no se puede deshacer."*
  - Botón secundario: **Cancelar**.
  - Botón primario destructivo: **Cerrar todo y completar pedido**.

- Nueva función `handleForceCompleteOrder()`:
  1. `UPDATE production_tasks SET status='completed', completed_at=now() WHERE sales_order_item_id IN (...) AND status <> 'completed'`.
  2. `UPDATE sales_order_items SET production_status='completed' WHERE sales_order_id = id AND production_status <> 'completed'`.
  3. `updateSalesOrderStatus(id, 'completed')`.
  4. Refrescar estado local (`setItems`, `setOrder`) y `loadOrderData()`.
  5. Invalidate React Query keys: `production-tasks`, claves del pedido.
  6. Toast informativo: "Pedido cerrado. Se completaron N tareas y M artículos pendientes."

- Manejar errores con toast destructivo y no cambiar el estado del pedido si falla algún UPDATE.

### 2. Sin cambios en BD

Las políticas RLS existentes sobre `production_tasks` y `sales_order_items` ya permiten al Admin/Gestor actualizar estos registros. No se requieren migraciones.

## Notas técnicas

- Importar `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, etc. desde `@/components/ui/alert-dialog` (ya usados en la pantalla para cancelación).
- Reutilizar el helper `updateSalesOrderStatus` existente.
- Mantener la regla actual: si el pedido está `cancelled`, no se ofrece este flujo.
- El conteo de tareas pendientes se hace en el momento del click (consulta fresca), no se depende de caché.

## QA

1. Pedido con todos los artículos completados → marcar como completado sigue funcionando sin diálogo extra.
2. Pedido con artículos sin completar y sin tareas → aparece diálogo con "X artículos, 0 tareas". Confirmar marca todo como completado.
3. Pedido con tareas pausadas/en curso → aparece diálogo con el conteo correcto. Confirmar las cierra todas.
4. Cancelar el diálogo → el pedido conserva su estado original.
5. Verificar que el panel de producción refleja las tareas como terminadas tras forzar el cierre.
