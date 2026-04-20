
Objetivo: quitar ya la regla hardcodeada que borra “Solapas” del PDF y dejar que mande solo la configuración real del producto.

## Qué está pasando ahora
He encontrado dos sitios donde el PDF se carga `Solapas` por código:
1. `src/utils/pdfGenerator.ts` → `sanitizeDescriptionForDocs(...)`
   - elimina cualquier línea cuyo label empiece por `SOLAPAS`
2. `src/utils/pdfGenerator.ts` → fallback de componentes cuando la descripción está vacía
   - elimina valores `0`
   - elimina labels que empiecen por `SOLAPAS`

Por eso no sale, aunque exista en la descripción o aunque esté forzado en documentos.

## Plan de cambio
1. Corregir `src/utils/pdfGenerator.ts`
   - quitar el borrado por nombre `SOLAPAS`
   - quitar también cualquier exclusión equivalente para `LOMO` si sigue existiendo
   - mantener solo los filtros legítimos:
     - `hide_in_documents`
     - `admin_only`
     - valor vacío
     - `No` cuando aplique
   - revisar el filtro de `0` para que no se cargue prompts forzados en docs

2. Hacer que el PDF respete `force_include_in_documents`
   - ampliar la carga de settings en PDF para no leer solo “ocultos”, sino también los prompts forzados y su condición
   - reutilizar la lógica existente de condición (`always`, `value_gt_zero`, `value_not_empty`) para que el PDF se comporte igual que al guardar la descripción en `QuoteNew` y `QuoteEdit`

3. Mantener la regla correcta del proyecto
   - si `description` existe: el PDF usa esa descripción como fuente de verdad
   - pero sin censura hardcodeada por nombre de campo
   - si `description` está vacía: el fallback de componentes también debe respetar settings reales, no reglas inventadas por label

4. Revisar impacto en OT
   - `src/utils/workOrderPdfGenerator.tsx` usa la misma sanitización
   - al corregir la función compartida, verificar que OT queda consistente y no reaparece nada que esté realmente marcado como oculto

5. Actualizar memoria/documentación interna
   - ahora mismo hay memorias que dicen que `SOLAPAS` se elimina siempre en PDF
   - eso quedará obsoleto y habrá que dejar documentado el comportamiento nuevo

## Archivos a tocar
- `src/utils/pdfGenerator.ts`
- revisión de consistencia en `src/utils/workOrderPdfGenerator.tsx`
- actualización de memorias/documentación relacionadas con sanitización y force include

## Resultado esperado
Caso exacto que quiero dejar resuelto:
- `Lomo` oculto en docs → no sale
- `Solapas (mm.): 0` no oculto / o forzado en docs → sí sale
- si la descripción del artículo ya lo contiene, el PDF no lo borra “por su nombre”

## Verificación al implementar
Haré estas comprobaciones:
1. presupuesto con descripción guardada que incluya `Solapas (mm.): 0`
2. presupuesto sin descripción, usando fallback de componentes
3. prompt con `force_include_in_documents = true` y condición `always`
4. prompt con `value_gt_zero` para confirmar que `0` no entra cuando no debe
5. comprobación visual de PDF y OT para confirmar que sale `Solapas` y no se rompe el resto
