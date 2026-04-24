# Memory: architecture/pricing/calculation-pipeline-complete
Updated: 2026-04-24

## Pipeline canónico del cálculo de precios

Orden estricto. Romperlo causa regresiones documentadas.

```
prompts → API pricing → basePrice/baseCompositePrice
       → × tarifa cliente (SOLO base)
       → + itemAdditionals (SIN tarifa, por tipo)
       → multi (repite por cantidad)
       → quote_items.price (decimales EXACTOS)
       → Σ items = subtotal
       → + quoteAdditionals (SIN tarifa)
       → quotes.final_price
```

## Tipos de ajuste y fórmulas
- `net_amount`: + value (en multi: multiValues[i] override)
- `percentage`: + basePrice * value/100  ← SIEMPRE sobre base SIN tarifa
- `quantity_multiplier`: + value * quantity
- `capacity_divider`: + value * Math.ceil(quantity / capacity_value)

`is_discount: true` → invierte signo. `is_active: false` → no aplica.

## Tarifa de cliente — REGLA DE ORO
- ✅ SOLO al precio base del API (simple: Price; compuesto: Σ componentes + padre).
- ❌ NUNCA a ajustes de ningún tipo (item ni presupuesto).
- En multi `%`: revertir tarifa antes de aplicar el porcentaje.
- `QuoteEdit.calculateSubtotal()` NO re-aplica tarifa (items ya la incluyen).
- `quoteAdditionals` NUNCA llevan tarifa.

## Compuestos
- baseCompositePrice = parentBasePrice + Σ componentPrice[i] (solo activos).
- Un PATCH por componente + uno al padre si tiene Excel.
- Instancias múltiples del mismo componente: aisladas por componentInstanceId.
- composite_output_aggregations: suma/promedia outputs entre componentes.

## Multi-cantidad
- multiRows[i] = { qty: Qi, totalStr: precioAPI(Qi), ...outputs }
- Por fila: rowPrice = totalStr + Σ ajustes(Qi)
- Selección: price del item = el de selectedMultiIndex
- Persistir TODO multi.rows aunque solo una esté seleccionada

## Aprobación
- resolveApprovedQuoteItemState: sincroniza prompts/outputs con cantidad aprobada
- Mantiene item_additionals íntegros
- Recalcula solo lo dependiente de cantidad (quantity_multiplier, capacity_divider, multiValues)
- NO consulta el API: usa snapshot de BD

## Persistencia decimal
- ❌ JAMÁS toFixed(2) ni Math.round en camino de guardado
- ✅ safePrice/parseEsNumber preservan todos los decimales
- ✅ Inputs: step="any" (no "0.01")
- ✅ Solo redondear para mostrar (fmtEUR), nunca para persistir
- Campos sensibles: quote_items.{price, item_additionals[].value, multi.rows[].totalStr, outputs[].value}, quotes.final_price

## Sincronización QuoteItem ↔ padre
- onChange solo si hay cambio real (guard de igualdad por objeto)
- Guardar SIN editar → price idéntico al céntimo en BD

## Documento completo
Ver `docs/calculo-precios-completo.md` para el mapa detallado, fórmulas y checklist obligatorio antes de cerrar cualquier cambio que toque pricing.
