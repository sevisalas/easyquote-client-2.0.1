

## Cantidad siempre primero en el formulario de prompts

### Qué se haría
Cuando un prompt está marcado como `is_quantity` en `product_prompt_settings`, moverlo automáticamente a la primera posición en el formulario de prompts (PromptsForm), independientemente del orden que devuelva la API.

### Cambios

**1. `src/components/quotes/PromptsForm.tsx`**
- Tras recibir los prompts ordenados, reordenar para que el prompt marcado como `is_quantity` aparezca primero.
- Se usa el hook `useProductPromptSettings` (ya disponible) para consultar `getQuantityPromptName()`.
- Si no hay ninguno marcado, el orden se mantiene tal cual (sin cambios).

**2. `src/components/quotes/ComponentTabsPromptsForm.tsx`** (si aplica a productos compuestos)
- Misma lógica: el prompt de cantidad del componente va primero.

### Comportamiento
- El campo de cantidad aparece siempre en la primera posición del formulario.
- El resto de campos mantiene su orden original de la API.
- Si no hay ningún prompt marcado como `is_quantity`, no cambia nada.

