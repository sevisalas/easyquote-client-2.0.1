

## Problema

Cuando se activan multi-cantidades, el sistema auto-selecciona el **primer prompt numérico** como campo de cantidad (`numericPrompts[0]`). En "Libros digitales", el campo "Páginas" aparece antes que "Ejemplares/Cantidad", así que se usa incorrectamente.

Esto también afecta a los PDFs (Templates 7/8 y `pdfGenerator.ts`) donde la cantidad se busca por heurística de texto (`label.includes('cantidad') || label.includes('ejemplares')`).

## Propuesta: Añadir `is_quantity` a `product_prompt_settings`

Añadir un flag `is_quantity` (boolean) a la tabla `product_prompt_settings` para que cada producto tenga marcado explícitamente cuál es su campo de cantidad. Esto se configura una vez por producto y se usa en toda la app.

### Cambios necesarios

**1. Base de datos** — Añadir columna `is_quantity` (boolean, default false) a `product_prompt_settings`. Crear constraint para que solo un prompt por producto pueda tener `is_quantity = true`.

**2. Pantalla de gestión de productos** (`src/pages/ProductManagement.tsx`) — En la tabla de configuración de prompts de cada producto, añadir un toggle/radio "Es campo de cantidad" que permita marcar un solo prompt como el de cantidad. Visualmente claro: un icono o badge junto al prompt seleccionado.

**3. Multi-cantidades en QuoteItem** (`src/components/quotes/QuoteItem.tsx`):
- Al activar multi-cantidades, pre-seleccionar el prompt marcado como `is_quantity` en lugar del primer numérico.
- Si no hay ninguno marcado, mantener el comportamiento actual (primer numérico) como fallback.
- El selector manual sigue disponible para que el usuario pueda cambiar si lo necesita.

**4. PDFs** (`src/utils/pdfGenerator.ts`, `Template7.tsx`, `Template8.tsx`):
- Consultar `product_prompt_settings` para identificar el campo `is_quantity` del producto.
- Usar ese campo para la columna "Cantidad" en lugar de la heurística por texto.
- Mantener la heurística como fallback si no hay configuración.

**5. Pedidos de venta** (`src/pages/SalesOrderNew.tsx`):
- Usar el campo marcado como `is_quantity` para extraer la cantidad del artículo en lugar de buscar por label "quantity"/"cantidad".

### Flujo del usuario

1. En Gestión de productos, al ver los prompts de "Libros digitales", marca "Ejemplares" como campo de cantidad.
2. Al crear un presupuesto con multi-cantidades, el sistema ya pre-selecciona "Ejemplares" automáticamente.
3. En el PDF, la columna cantidad muestra el valor de "Ejemplares", no de "Páginas".

### Ventajas
- Configuración explícita por producto, sin heurísticas frágiles.
- Se reutiliza la infraestructura existente de `product_prompt_settings`.
- Compatible con todos los productos: cada uno puede tener su propio campo de cantidad.
- Fallback al comportamiento actual si no se configura.

