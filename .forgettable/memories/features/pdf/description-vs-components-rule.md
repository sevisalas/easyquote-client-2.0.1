# Memory: features/pdf/description-vs-components-rule
Updated: 2026-03-26

## Regla: descripción vs prompts/componentes en PDF

- Si el artículo tiene **descripción** (no vacía): se muestra SOLO la descripción. No se muestran prompts individuales ni secciones de componentes (Interior, Cubierta, etc.).
- Si el artículo tiene la **descripción vacía**: se generan los prompts y secciones de componentes automáticamente para rellenar el PDF.
- Esta regla aplica independientemente de `description_manual` o `hideAllPromptsInDocs`.
- La descripción es la ÚNICA fuente de verdad cuando existe.
