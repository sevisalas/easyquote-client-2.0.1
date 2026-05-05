## Objetivo
Hacer que el portal B2B use exactamente los mismos productos y la misma configuración que ya existen en la app, en lugar de inventarse una segunda configuración en `b2b_catalog_items`.

## Qué está mal ahora
He revisado el código y el problema es real:

- `src/pages/B2bCatalog.tsx` sigue teniendo una capa propia de configuración del portal:
  - `image_url`
  - `default_prompts`
  - `exposed_prompt_ids`
  - botón `Configurar`
- `src/pages/PortalHome.tsx` todavía construye el diálogo del portal a partir de `exposed_prompt_ids` y `default_prompts` del catálogo.
- `supabase/functions/b2b-pricing/index.ts` y `supabase/functions/b2b-create-quote/index.ts` recalculan usando esa configuración duplicada del catálogo.

Eso contradice justo lo que dices: el producto ya está definido en la app y el portal debería usar ese mismo producto, no una versión paralela.

## Plan de corrección

### 1) Quitar la configuración duplicada del catálogo B2B
Voy a dejar `b2b_catalog_items` solo como publicación de catálogo:
- producto enlazado
- nombre visible
- descripción visible
- orden
- activo/inactivo

Y dejaré de usar desde frontend y backend:
- `default_prompts`
- `exposed_prompt_ids`
como fuente de comportamiento del portal.

También quitaré del UI de catálogo lo que induce a error:
- el botón `Configurar`
- la lógica de “variables cliente”
- la idea de que el portal tenga prompts propios distintos del producto real

### 2) Hacer que el portal lea la configuración real del producto
El portal debe basarse en la misma definición que usa la app principal:
- prompts que vienen de `easyquote-pricing`
- reglas guardadas en `product_prompt_settings`
- visibilidad real (`is_hidden`, `admin_only`, etc.)

La idea es:
- cargar prompts del producto real enlazado
- aplicar las reglas existentes de `product_prompt_settings`
- ocultar en portal lo que ya está marcado como oculto o solo admin
- usar los labels/configuración ya existentes del producto

Así el portal no “redefine” el producto, solo lo presenta.

### 3) Ajustar el cálculo B2B para que no dependa del catálogo como configurador
Actualizaré ambas edge functions:

- `b2b-pricing`
- `b2b-create-quote`

para que:
- usen el `product_id` del catálogo solo como enlace al producto real
- acepten los valores que el cliente cambie en el portal
- dejen de mezclar `default_prompts` + `exposed_prompt_ids`
- calculen sobre los prompts reales del producto

Con esto, el presupuesto del portal saldrá del mismo producto real, no de una configuración paralela montada encima.

### 4) Mantener la imagen desde outputs del API con fallback
Esto sí encaja con lo que pediste:
- si el API devuelve un output de imagen, usarlo como imagen del producto
- si no existe, usar la imagen de respaldo

Pero dejaré esa parte desacoplada de la falsa “configuración del portal”, para que la imagen no dependa de duplicar datos del producto.

### 5) Revisar el texto y la UX para que no vuelva a confundir
Cambiaré los textos para que quede claro que:
- el catálogo solo publica productos al portal
- la configuración del producto se hace en la app principal
- el portal usa esa misma configuración

## Resultado esperado
Después del cambio:
- no habrá una segunda configuración del producto en el portal
- el portal usará los mismos productos que ya están definidos en la app
- no se pedirá reconfigurar prompts allí
- la imagen vendrá del output image del API si existe
- el catálogo B2B quedará como un publicador, no como otro configurador

## Detalle técnico
Archivos a tocar:
- `src/pages/B2bCatalog.tsx`
- `src/pages/PortalHome.tsx`
- `supabase/functions/b2b-pricing/index.ts`
- `supabase/functions/b2b-create-quote/index.ts`

Dirección del cambio:
- eliminar dependencia funcional de `default_prompts` y `exposed_prompt_ids`
- reutilizar `product_prompt_settings` como fuente de visibilidad/configuración del producto
- mantener `image_url` solo como fallback, no como verdad principal

Si apruebas este plan, lo implemento así.