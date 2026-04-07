# Memory: features/customers/tariff-system-architecture
Updated: 2026-04-07

## Tarifa de cliente (descuentos automáticos post-cálculo)

### Tabla: `tariffs` (a nivel de organización)
- Campos: organization_id, name, percentage, is_discount, is_active
- RLS: admins CRUD, todos los miembros SELECT
- Se asigna a clientes mediante `customers.tariff_id`

### Tabla: `customers`
- Nuevo campo: `tariff_id UUID REFERENCES tariffs(id) ON DELETE SET NULL`

### Comportamiento
- Las tarifas se definen centralmente en `/clientes/tarifas`
- Se asignan individualmente a cada cliente (un cliente = una tarifa como máximo)
- Se aplican automáticamente al total del presupuesto (post-cálculo)
- **No visibles** en PDFs, exportaciones a Holded, ni para usuarios no-admin
- Solo admins ven el badge "Tarifa cliente" en el resumen de totales

### Hooks
- `useTariffs(orgId)` — CRUD completo para la página de Tarifas
- `useCustomerDiscounts` — DEPRECADO, migrado a tariffs

### Páginas
- `/clientes/tarifas` — CRUD de tarifas de la organización (no lista clientes)
- `ClienteForm.tsx` — selector de tarifa para asignar a un cliente

### Integración con presupuestos
- El descuento se obtiene desde `customers.tariff_id` → `tariffs`
- Se aplica al total del presupuesto, guardado en `final_price`
