## Fase 2 — Selector de subproducto en pruebas

Ya implementado en la fase anterior: tab "Subproductos" en `/admin/productos/test`, banner explicativo y carga inicial mostrando solo el prompt selector.

Lo que falta para que la prueba sea claramente "subproducto":

### 1. Resaltar el prompt selector

En la página de pruebas, cuando `subproductMode` está activo:
- Buscar en `product_prompt_settings` el prompt con `is_subproduct_selector=true` para `(api_user_id, easyquote_product_id)`.
- Renderizarlo en una tarjeta destacada arriba del formulario, separado del resto de prompts (mismo control, distinto contenedor): borde primario, etiqueta "Subproducto" y texto de ayuda "Elige un subproducto para cargar el resto de campos".
- Ocultar el resto de prompts hasta que el selector tenga un valor distinto del placeholder/primer GET. Una vez el usuario elige, el PATCH ya filtra y aparecen los demás prompts (flujo actual).

### 2. Indicador en cabecera

Mostrar al lado del nombre del producto un badge "Subproducto: <valor seleccionado>" en cuanto el usuario elige opción, para que quede claro qué subproducto se está probando en cada momento.

### 3. Cambio de subproducto

Botón pequeño "Cambiar subproducto" junto al badge que limpia el valor del selector y vuelve al estado inicial (oculta el resto de prompts hasta nueva elección). Internamente: reset de `promptValues` salvo el id del selector que se vacía, y dispara nuevo PATCH/GET.

### 4. Pestaña "Productos" sin cambios

Confirmado: en la pestaña Productos, aunque el producto tenga `has_subproducts=true`, se comporta como cualquier otro (no se aplica ningún filtrado ni se destaca el selector). Solo se aplica el modo subproducto cuando se llega desde la pestaña Subproductos o con `subproductMode=1` en URL.

### Detalles técnicos

- Cargar `product_prompt_settings` en `ProductTestPage` (hook `useProductPromptSettings`) ya disponible. Identificar `selectorPromptId` por `is_subproduct_selector=true`.
- Filtrar el array `prompts` que se pasa a `ComponentTabsPromptsForm` / `PromptsForm` para que en modo subproducto solo incluya:
  - Solo el selector si aún no hay valor elegido.
  - Resto de prompts una vez el selector tiene valor (después del PATCH inicial el API ya devuelve la lista filtrada, así que basta con dejar pasar todos los prompts que vengan en `pricing.prompts`).
- Sin cambios de BD. Sin cambios en edge functions. Sin tocar portal/cliente ni `b2b_catalog_items`.

### Fuera de alcance (Fase 3)

- Selector en `/b2b-catalog` para fijar subproducto por catálogo.
- Cambios en `b2b-pricing` para que el portal cliente respete el subproducto fijado.
- Persistencia del subproducto elegido en pruebas (es solo prueba, no se guarda).
