# Panel de taller → Listado plano de trabajos

Reemplazar la vista actual de `/panel-produccion-lista` (que agrupa por pedido y muestra cabecera grande + items expandibles) por una **tabla plana**, donde cada fila es un artículo de pedido (un "trabajo").

## Alcance

- Solo se toca `src/pages/ProductionBoard.tsx` (la vista Lista).
- No se modifican las vistas Compacta ni Tablero, ni la lógica de pedidos, ni la BD.
- Se mantiene el `ProductionBoardViewSwitcher` y el aviso de móvil ya existente.

## Columnas (en este orden)

| Columna | Origen |
|---|---|
| Fecha | `sales_orders.order_date` |
| Nº pedido | `sales_orders.order_number` (clicable → `/pedidos/{id}`) |
| Cliente | `sales_orders.customer_id` → `<CustomerName />` |
| Artículo | `sales_order_items.product_name` |
| Estado | `sales_order_items.production_status` (Badge: Pendiente / En proceso / Completado) |
| Cantidad | `sales_order_items.quantity` |

Diseñado pensando en añadir más columnas después (entrega, observaciones, asignado, etc.).

## Filtros (cabecera de la tabla)

- **Excluir terminados y cancelados** (activado por defecto, toggle):
  - excluye `sales_orders.status = 'cancelled'`
  - excluye `sales_order_items.production_status = 'completed'`
- Búsqueda libre por nº pedido / cliente / artículo (input simple).
- Selector de estado del trabajo (Todos / Pendiente / En proceso). "Completado" solo aparece si se desactiva el filtro anterior.

Orden por defecto: `delivery_date` ASC (nulls last), tie-break por `order_date` DESC.

## Carga de datos

Misma consulta base que ahora, pero:
- En `sales_orders` filtrar `status NEQ cancelled` y por `organization_id` (igual que ahora).
- Tras unir items, **aplanar** a `jobs: Array<{ orderId, orderNumber, orderDate, deliveryDate, customerId, orderStatus, itemId, productName, quantity, productionStatus }>`.
- Aplicar el filtro de "terminados/cancelados" en cliente sobre ese array (mantiene la consulta simple y permite alternar el toggle sin re-fetch).

## UI

- Tabla con `@/components/ui/table` (shadcn) — filas con hover y `cursor-pointer` que navegan al detalle del pedido (`/pedidos/{orderId}`) o al artículo si existe esa ruta (mantener pedido por ahora).
- Vista mobile: mantener el mensaje actual de "usa Compacta o Tablero".
- Vacío: mensaje "No hay trabajos pendientes".

## No incluido (para más tarde)

- Ordenación por columna clicable.
- Exportar a Excel.
- Acciones por fila (cambiar estado inline, asignar operario).
- Paginación (de momento todo en una página, como hoy).
