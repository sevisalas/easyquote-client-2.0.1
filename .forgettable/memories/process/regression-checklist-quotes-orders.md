# Memory: process/regression-checklist-quotes-orders
Updated: 2026-04-24

## Checklist OBLIGATORIO antes de cerrar cualquier cambio que toque
presupuestos, pedidos, QuoteItem, QuoteEdit, QuoteNew, pricing, tarifas,
ajustes (additionals), prompts, outputs o multi-cantidad.

Estas funcionalidades han fallado en el pasado por cambios "inofensivos".
Validar SIEMPRE las siguientes invariantes:

### 1. Persistencia de precio al guardar sin editar
- Abrir un presupuesto existente.
- Guardar SIN tocar ningún artículo.
- ❗ El total no debe cambiar ni un céntimo. El `price` de cada item debe
  mantenerse exactamente igual al de la BD.
- Regresión histórica: el editor recalculaba items intactos y bajaba el total
  (ej. presupuesto 640 pasaba de 1.845,75 € → 1.680 €).

### 2. Tarifa de cliente NO se aplica a ajustes
- La tarifa solo se aplica al precio base del API (output `Price` o suma de
  componentes en compuestos).
- ❌ Nunca a `net_amount`, `percentage`, `quantity_multiplier`, `capacity_divider`.
- Verificar tanto en QuoteItem como en QuoteEdit/QuoteNew (subtotales).

### 3. Prompts guardados NO se sobrescriben con API
- Al cargar un quote_item, los prompts guardados son DEFINITIVOS.
- El PATCH de pricing no puede reemplazar `promptValues` salvo en producto
  realmente nuevo (sin `initialData`).
- Verificar en exportación a Holded: solo deben aparecer prompts guardados,
  nunca prompts añadidos por el API.

### 4. Multi-cantidad: ajustes porcentuales
- En modo multi, ajustes `percentage` se calculan sobre el precio base API
  SIN tarifa (revertir tarifa antes del cálculo).
- Overrides `net_amount` por cantidad (multiValues) deben respetarse.

### 5. Aprobación de presupuesto
- Mantiene `item_additionals` y la cantidad seleccionada.
- Sincroniza prompts/outputs con la cantidad aprobada usando
  `resolveApprovedQuoteItemState`.
- El precio aprobado coincide con el mostrado en el presupuesto.

### 6. Productos compuestos
- Precio = suma de componentes activos.
- Un único PATCH por componente, no recalcular en bucle.
- Instancias múltiples del mismo componente mantienen datos aislados.

### 7. Visibilidad de prompts en documentos
- Prompts ocultos por selección dinámica (visibilidad condicional) NO se
  exportan a Holded ni aparecen en PDFs.
- `admin_only` implica `hide_in_documents`.

### 8. Numeración y duplicación
- Duplicar presupuesto usa `next_document_number` RPC, nunca cálculo manual.
- Numeración aislada por `organization_id`.

### 9. Sincronización QuoteItem → padre
- Solo se propaga cuando hay cambios reales (guard de igualdad por objeto).
- Evitar bucles de re-render que invaliden el estado del usuario.

## Cómo usar este checklist
1. Antes de empezar el cambio: identificar qué puntos toca.
2. Tras implementar: ejecutar mentalmente cada punto afectado.
3. Si el cambio toca pricing/tarifas/ajustes/persistencia → validar 1, 2, 3, 4
   SIEMPRE, aunque parezcan no relacionados.
4. No cerrar la tarea sin esta validación.
