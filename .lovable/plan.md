

## Plan: Rellenar `composite_data` desde quote_items al cargar el pedido

### Problema
Los pedidos creados antes del fix no tienen `composite_data` en `sales_order_items`. Migrar manualmente la BD no es viable.

### Solución
En `SalesOrderDetail.tsx`, después de cargar los items del pedido, si el pedido tiene `quote_id` y algún item tiene `composite_data` vacío, buscar los `quote_items` del presupuesto origen y copiar el `composite_data` a los items correspondientes (matching por `product_id` + posición). Además, persistir el dato en BD para que solo se haga una vez.

### Cambios

**`src/pages/SalesOrderDetail.tsx`** — en `loadOrderData`, después de `fetchSalesOrderItems`:
1. Si `orderData.quote_id` existe y hay items sin `composite_data`, hacer un query a `quote_items` del presupuesto origen filtrando solo los **aceptados** (`accepted = true`).
2. Para cada item del pedido sin `composite_data`, buscar su quote_item correspondiente (por `product_id` y posición) y copiar el `composite_data`.
3. Actualizar los items en memoria y persistir en BD en background (`UPDATE sales_order_items SET composite_data = ... WHERE id = ...`).

### Lógica de matching
- Emparejar por `product_id` y `position` (ambos existen en quote_items y sales_order_items).
- Solo copiar si el quote_item tiene `composite_data` no nulo.

### Impacto
- Solo afecta pedidos con `quote_id` (creados desde presupuesto).
- Se auto-corrige la primera vez que se abre el pedido; las siguientes cargas ya tienen el dato.
- No requiere migración manual ni SQL.

