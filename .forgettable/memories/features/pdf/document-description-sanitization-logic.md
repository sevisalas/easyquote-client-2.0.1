# Memory: features/pdf/document-description-sanitization-logic
Updated: 2026-03-26

## Regla principal: descripción vs prompts/componentes en PDF

- Si el artículo tiene **descripción** (no vacía): se muestra SOLO la descripción. No se muestran prompts individuales ni secciones de componentes (Interior, Cubierta, etc.). La descripción es la ÚNICA fuente de verdad.
- Si el artículo tiene la **descripción vacía**: se generan los prompts y secciones de componentes automáticamente para rellenar el PDF.
- Esta regla aplica independientemente de `description_manual` o `hideAllPromptsInDocs`.

## Filtrado en componentes auto-generados (cuando descripción vacía)

Cuando se generan secciones de componentes automáticamente, se filtran:
- Valores `No` (case-insensitive)
- Valores `0`
- Etiquetas que empiecen por `SOLAPAS`
- Campos marcados como `hide_in_documents` en `product_prompt_settings`

## Sanitización de la descripción (sanitizeDescriptionForDocs)

Cuando se muestra la descripción, se procesan línea a línea:
1. Líneas con valor `No` → se eliminan
2. Líneas con etiqueta `SOLAPAS` → se eliminan siempre
3. Líneas con campos marcados como `hide_in_documents` → se eliminan
4. Se respeta la configuración por sección (parent vs componentes)
