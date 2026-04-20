# Memory: features/products/force-include-in-documents
Updated: 2026-04-20

## Forzar inclusión de prompts en documentos (opuesto de "Ocultar en docs")

Cada prompt configurado en `product_prompt_settings` admite dos campos opuestos a `hide_in_documents`:

- `force_include_in_documents` (bool): si está activo, el prompt SIEMPRE se incluye en la descripción auto-generada y en exportaciones a Holded, aunque por defecto no apareciera o estuviera marcado como oculto.
- `force_include_condition` (text): condición opcional. Valores: `always` (default), `value_gt_zero`, `value_not_empty`.

Mutuamente excluyente con `hide_in_documents` y `admin_only` (al activar uno, se desactivan los otros automáticamente desde la UI en `ProductConfigPage`).

### Aplicación
- `QuoteNew.tsx` y `QuoteEdit.tsx`: la auto-generación de descripción (cuando `description_manual=false`) bypassa los filtros normales para los prompts forzados, tanto a nivel padre como en componentes de productos compuestos.
- `holded-export-estimate`, `holded-export-order`, `holded-update-order`: el filtro de visibilidad respeta `force_include`, ignorando dynamic visibility (EasyQuote) y `hide_in_documents`/`admin_only` cuando la condición se cumple.
- PDF y OT: NO requieren cambios. La descripción es la fuente de verdad cuando existe (regla del proyecto), por lo que el campo forzado ya queda incluido al guardar.

### Caso de uso típico
Producto encuadernado con componente "Cubierta" → prompt `solapas` marcado como `force_include_in_documents=true`, `condition=value_gt_zero` → aparece "Solapas: 5" en descripción cuando >0, no aparece cuando =0.
