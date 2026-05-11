## Fase 1 — Identificación de Subproductos

Objetivo: marcar qué productos tienen subproducto y qué prompt actúa como selector. Sin tocar portal ni cálculo todavía.

### 1. Esquema de BD (migración)

`product_component_settings`
- `has_subproducts` boolean default false

`product_prompt_settings`
- `is_subproduct_selector` boolean default false

Compartidos por `api_user_id` (igual que el resto de flags).

### 2. Detección automática (sugerencia)

Al abrir la ficha de un producto en `/admin/productos/:id`:
- Si el GET inicial de EasyQuote devuelve **exactamente 1 prompt** y aún no hay flags marcados → mostrar banner sugerencia:
  > "Este producto parece tener subproductos. El campo **'<nombre del prompt>'** sería el selector. ¿Activar?" [Activar] [Ignorar]
- Al pulsar Activar: marca `has_subproducts=true` en el producto + `is_subproduct_selector=true` en ese prompt.
- Si GET devuelve >1 prompt → no se sugiere nada (producto normal).

El admin también puede activar/desactivar manualmente desde:
- Switch "Tiene subproductos" en la cabecera del producto.
- En la lista de prompts, badge clicable "Selector de subproducto" en el prompt elegido (solo uno a la vez).

### 3. UI — nueva pestaña "Subproductos"

En `/admin/productos` (ProductManagement), añadir 3ª pestaña junto a Productos y Componentes:

```text
[ Productos ] [ Componentes ] [ Subproductos ]
```

"Subproductos" lista los productos con `has_subproducts=true`, mostrando:
- Nombre del producto
- Nombre del prompt selector (badge)
- Nº de opciones del selector (si está cacheado en última GET)

Misma card / acciones que las otras pestañas (editar, duplicar, etc.).

En la ficha del producto, el prompt marcado como selector lleva un badge visible "Selector de subproducto".

### 4. Página de pruebas — modo específico

`/admin/productos/test` (ProductTestPage):
- Mantener intacto el modo actual ("Prueba genérica").
- Añadir toggle/segmented control en la cabecera: **Genérica · Subproducto**.
- Pestaña "Subproducto" solo activa si el producto seleccionado tiene `has_subproducts=true`. Flujo:
  1. GET inicial → renderiza solo el selector destacado.
  2. Al elegir opción → PATCH → renderiza el resto del formulario filtrado.
  3. Visualizar prompts/outputs/precio igual que el modo genérico, pero claramente etiquetado como "filtrado por subproducto = X".

Sin lógica de portal, sin guardar nada en `b2b_catalog_items`, solo identificación + visualización.

### Detalles técnicos

- Migración SQL: 2 columnas booleanas + índice parcial opcional sobre `is_subproduct_selector` para queries rápidas.
- Hooks afectados: `useProductComponentSettings` (añadir `hasSubproducts` + setter), `useProductPromptSettings` (añadir `isSubproductSelector` + setter).
- Tipos regenerados desde Supabase (automático, no tocar `types.ts`).
- Detección: hacerla en el componente de detalle de producto al recibir respuesta del GET (`prompts.length === 1 && !hasSubproducts && !ignoredHint`). Estado "ignorado" puede vivir en localStorage por producto, no en BD (es solo UX).
- Restricción: solo un prompt por producto puede tener `is_subproduct_selector=true` (validar en mutation, mostrar warning si el admin intenta marcar otro).

### Fuera de alcance (Fase 2+)

- Cambios en `b2b-pricing` edge function.
- Cambios en el portal cliente (PromptsFormLite, PortalQuote).
- Cambios en `b2b_catalog_items` (subproducto fijado por catálogo).
- Cualquier lógica de PATCH automático en producción.

Cuando pruebes esta fase y confirmes la identificación, pasamos a Fase 2 (selector en B2B catalog + portal).
