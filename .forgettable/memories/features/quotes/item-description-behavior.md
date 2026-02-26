# Memory: features/quotes/item-description-behavior
Updated: 2026-02-26

## Descripción automática de artículos

Al guardar un presupuesto (QuoteNew/QuoteEdit), si el campo `description` de un artículo está vacío y `description_manual` es `false`, se genera automáticamente una descripción a partir de los valores de los prompts guardados, separados por comas.

### Flag `description_manual`
- Columna booleana en `quote_items` y `sales_order_items` (default `false`).
- Se activa (`true`) cuando el usuario edita manualmente el campo de descripción en la UI.
- Cuando es `true`, la descripción NO se regenera automáticamente al guardar.
- Se resetea a `false` cuando el usuario cambia de producto.

### Flujo
1. Usuario selecciona producto → descripción vacía, `description_manual = false`.
2. Al guardar → si descripción vacía y no manual: se construye desde los valores de prompts (separados por comas).
3. Si el usuario edita la descripción → `description_manual = true`, no se sobrescribe.
4. Al editar presupuesto guardado y re-guardar → la descripción manual se preserva.
