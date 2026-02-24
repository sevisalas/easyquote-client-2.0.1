
# Plan: Ocultar prompts a nivel de tenant en documentos (PDF y Holded)

## Resumen

Nuevo ajuste a nivel de organizacion (tenant) que permite desactivar la inclusion de prompts en los documentos exportados (PDF y Holded). Cuando esta activado, los documentos solo mostraran:
- **Nombre del producto** (product_name)
- **Descripcion** del item (campo `description` del quote_item, que viene del API de EasyQuote)

La descripcion debera soportar **texto enriquecido** (saltos de linea, negritas basicas).

## Cambios necesarios

### 1. Base de datos: nueva columna en `organizations`

Agregar columna `hide_all_prompts_in_documents` (boolean, default false) a la tabla `organizations`.

```text
organizations
  + hide_all_prompts_in_documents  BOOLEAN  DEFAULT false
```

Este flag se gestiona desde el panel de superadmin y aplica a toda la organizacion.

### 2. Panel SuperAdmin: toggle para gestionar el flag

**Archivo**: `src/pages/IntegrationAccess.tsx` (o crear seccion en la vista de suscriptores)

Agregar un toggle "Ocultar prompts en documentos" en la tarjeta de cada organizacion en la pagina de accesos a integraciones (donde ya se gestionan los flags como `generate_pdfs`). Al activarlo, se actualiza `organizations.hide_all_prompts_in_documents`.

### 3. Generador de PDF (`src/utils/pdfGenerator.ts`)

Antes de formatear los items:
1. Consultar `organizations.hide_all_prompts_in_documents` para la organizacion del presupuesto
2. Si el flag esta activo:
   - **No incluir** el array `promptsFormatted` (queda vacio)
   - **No incluir** las secciones de componentes (componentSections)
   - **Si incluir** el campo `description` del item (renderizado con soporte de saltos de linea)

### 4. Templates PDF (todos los templates, no solo Template7)

Cuando un item tiene `description` y NO tiene prompts, mostrar la descripcion debajo del nombre del producto. La descripcion se renderizara con soporte basico de texto enriquecido:
- Saltos de linea (`\n` y `\r\n`)
- Tags HTML basicos si los hubiera (`<br>`, `<b>`, `<p>`)

### 5. Exportacion Holded - Presupuestos (`supabase/functions/holded-export-estimate/index.ts`)

Antes de construir la descripcion de cada item:
1. Consultar el flag `hide_all_prompts_in_documents` de la organizacion
2. Si esta activo:
   - Usar `item.description` directamente como descripcion del articulo en Holded
   - No iterar los prompts ni los componentes
   - Mantener los additionals como lineas separadas (comportamiento actual)

### 6. Exportacion Holded - Pedidos (`supabase/functions/holded-export-order/index.ts`)

Misma logica que el punto 5, aplicada a la exportacion de pedidos.

## Secuencia de implementacion

1. Migracion DB: agregar columna a `organizations`
2. UI SuperAdmin: toggle en IntegrationAccess o SubscriberEdit
3. pdfGenerator.ts: leer flag y condicionar la inclusion de prompts
4. Templates: renderizar `description` con texto enriquecido cuando no hay prompts
5. Edge functions Holded: leer flag y condicionar la construccion de la descripcion

## Puntos clave

- El flag es por **organizacion**, no por producto. Campillo, Anebri o cualquier tenant que lo active dejara de ver prompts en TODOS sus documentos.
- La `description` ya existe en `quote_items` y se rellena desde la API de EasyQuote (contiene la descripcion generada del producto con los parametros seleccionados).
- No se eliminan los prompts de la base de datos ni de la UI de configuracion; solo se ocultan en la salida documental.
- Los additionals (retractilado, cajas, portes) siguen apareciendo como lineas independientes en Holded.
