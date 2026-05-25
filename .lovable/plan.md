## Objetivo
Eliminar para siempre cualquier recálculo en la aprobación/edición de presupuestos compuestos multi-cantidad. La fotografía completa de los componentes para CADA cantidad de la tabla multi-Q debe quedar persistida en `quote_items.composite_multi_data` y ser la única fuente de verdad al aprobar o reabrir.

## Alcance
Solo presupuestos de productos compuestos multi-cantidad. El comportamiento de simples y de la cantidad principal de compuestos NO se toca (ya funcionaba).

## Cambios

### 1. `src/components/quotes/QuoteItem.tsx` (compositeMultiResults)
Hoy la query devuelve solo `{ qty, totalPrice }`. Ampliarla para que, por cada `qty` de la tabla multi, devuelva la foto completa:
```
{
  qty,
  totalPrice,
  components: [
    {
      componentId, instanceIndex, productId, alias,
      inputs: [...],           // los enviados al motor
      outputValues: [...],     // respuesta cruda de easyquote-pricing
      price                    // extraído
    }
  ],
  parentOutputs: [...]         // si aplica, los del padre en esa qty
}
```
Esto se obtiene de las llamadas que YA se hacen; solo se conserva `data` en lugar de descartarlo.

Exponer este objeto al padre vía la prop `onChange`/snapshot que ya usa `QuoteNew`/`QuoteEdit` para persistir el item, añadiendo `compositeMultiData` al snapshot.

### 2. `src/pages/QuoteNew.tsx` y `src/pages/QuoteEdit.tsx`
- En el `ItemSnapshot`, aceptar y propagar `compositeMultiData`.
- Al guardar (insert/update de `quote_items`), incluir `composite_multi_data: item.compositeMultiData ?? null`.
- Al cargar (QuoteEdit), leer `composite_multi_data` de la fila y pasarlo a `QuoteItem` como `initialData.compositeMultiData` para que se hidrate sin pedir nada al motor.

### 3. `supabase/functions/approve-quote/index.ts`
En la lógica que hoy hace `syncCompositeDataWithQuantity(item.composite_data, finalQuantity)`:
- Si existe `item.composite_multi_data?.[finalQuantity]`, usar esa foto directamente para construir el nuevo `composite_data` que se copia a `sales_order_items` (sin llamar al motor, sin recalcular).
- Si no existe (presupuestos antiguos previos a este cambio), mantener el comportamiento actual como fallback y registrar un `console.warn` para diagnóstico.

### 4. Migración (ya aplicada)
`quote_items.composite_multi_data jsonb` — listo.

## Lo que NO cambia
- `sales_order_items` no recibe nuevo campo (el pedido es de una sola cantidad).
- `composite_data` actual sigue siendo la foto "principal" (Q1 o cantidad aprobada).
- Productos simples y multi-cantidad de simples: sin cambios.
- Flujo de visualización de PDF/Holded: sin cambios.

## Pasos de implementación
1. Ampliar `compositeMultiResults` queryFn para devolver foto completa.
2. Construir y propagar `compositeMultiData` en el snapshot del item.
3. Persistir y cargar `composite_multi_data` en QuoteNew y QuoteEdit.
4. Adaptar `approve-quote` para consumir `composite_multi_data[finalQuantity]` y rellenar `composite_data` sin llamar al motor.
5. Verificar build y probar: crear presupuesto compuesto con 3 cantidades, recargar (sin llamadas al motor), aprobar una qty distinta a Q1 y comprobar que `sales_order_items.composite_data` coincide con la foto guardada.

## Riesgos / notas
- Tamaño de `composite_multi_data`: aceptable (JSONB), suele ser <50 KB por item.
- Presupuestos antiguos sin `composite_multi_data` siguen funcionando vía fallback.
- No se introduce migración de datos retroactiva: los presupuestos creados antes de este cambio seguirán dependiendo del comportamiento actual hasta que se vuelvan a editar/guardar.
