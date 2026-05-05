## Problema

En `/configuracion/portal-b2b`, al añadir un producto al catálogo B2B aparece un desplegable con cientos de entradas y **todas se llaman "Producto"**.

## Causa

En `src/pages/B2bCatalog.tsx` (líneas 110-116) el mapeo de la respuesta de la edge function `easyquote-products` usa los campos equivocados:

```ts
name: p.name ?? p.title ?? p.displayName ?? "Producto"
```

Pero la API de EasyQuote devuelve **`productName`** (así está tipado en `ProductManagement.tsx` y `ProductConfigPage.tsx`). Como ninguno de los campos buscados existe, todos caen al fallback `"Producto"`. Además se cargan todos de golpe (cientos), sin búsqueda ni categoría.

## Solución

Reescribir el selector de producto del diálogo "Añadir producto" en `B2bCatalog.tsx` para que sea utilizable:

### 1. Mapeo correcto de campos
Leer `productName` (con fallbacks a `name`/`title` por seguridad) y también capturar `category` y `isActive`.

```ts
{
  id: String(p.id ?? p.productId ?? ""),
  name: p.productName ?? p.name ?? p.title ?? `Producto ${p.id}`,
  category: p.category ?? "",
  isActive: p.isActive !== false,
}
```

### 2. Reemplazar el `<Select>` plano por un `Combobox` con búsqueda
Usar el patrón ya existente en el proyecto (`Command` + `Popover` de shadcn, igual que en `QuoteItem.tsx` para elegir producto en presupuestos):
- Input de búsqueda por nombre o categoría.
- Lista virtualizada/limitada (mostrar primeros 50 + filtrar al teclear).
- Mostrar `productName` como texto principal y `category` como subtítulo gris.
- Badge "Inactivo" si `isActive === false` (y opción de ocultarlos por defecto).

### 3. Filtros rápidos arriba del combobox
- Filtro por categoría (dropdown con las categorías únicas detectadas).
- Toggle "Mostrar inactivos" (oculto por defecto).
- Ocultar productos ya añadidos al catálogo B2B (evita duplicados accidentales).

### 4. Auto-rellenar el nombre público
Cuando el admin selecciona un producto, autocompletar `draft.name` con el `productName` real (hoy ya lo intenta pero recibe `"Producto"`). Sigue siendo editable porque el nombre del catálogo B2B es el que verá el cliente final.

### 5. En la lista de items ya guardados
El badge `productNameById[it.product_id]` también muestra mal el nombre por la misma razón → queda arreglado automáticamente con el fix del mapeo.

## Archivos a tocar

- `src/pages/B2bCatalog.tsx` — único archivo afectado (mapeo + UI del selector).

## Fuera de alcance

- No se toca la edge function `easyquote-products` (devuelve bien los datos).
- No se toca la base de datos.
- El diálogo "Configurar" (default_prompts / exposed_prompt_ids) sigue igual.
