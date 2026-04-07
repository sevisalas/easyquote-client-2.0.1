# Memory: features/customers/customer-discounts-architecture
Updated: 2026-04-07

## Tarifa de cliente (descuentos automáticos post-cálculo)

### Tabla: `customer_discounts`
- Campos: customer_id, organization_id, name, percentage, is_discount, is_active
- RLS: solo admins de la organización (función `is_org_admin`)
- FK cascade: se borran si se borra el cliente

### Comportamiento
- Los descuentos se aplican automáticamente al total del presupuesto (post-cálculo)
- **No visibles** en PDFs, exportaciones a Holded, ni para usuarios no-admin
- Solo admins ven el badge "Tarifa cliente" en el resumen de totales
- Se gestionan desde `ClienteForm.tsx` (sección visible solo para admins)

### Hooks
- `useCustomerDiscounts(customerId, orgId)` — CRUD completo para ClienteForm
- `useActiveCustomerDiscounts(customerId, orgId)` — solo lectura para QuoteNew/QuoteEdit

### Integración con presupuestos
- `QuoteNew.tsx`: `calculateDiscountAdjustment(subtotal)` se aplica en el `useMemo` de totals
- `QuoteEdit.tsx`: `calculateDiscountAdjustment(total)` se aplica al final de `calculateTotal()`
- El descuento se guarda implícitamente en `final_price` (no como línea separada)
