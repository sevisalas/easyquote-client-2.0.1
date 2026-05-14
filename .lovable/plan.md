## Objetivo
Hacer que el portal envíe una sola petición útil a `b2b-pricing` por cálculo, evitando que el mismo body completo se mande 3 veces seguidas.

## Diagnóstico
El payload que has pegado confirma que no son 3 cambios distintos del usuario: es el mismo `catalog_item_id` y el mismo `overrides` completo repetido.

En `src/pages/PortalHome.tsx` el problema viene de esta secuencia:

1. Se abre el configurador y se hace un cálculo.
2. La respuesta rellena `rawPrompts`.
3. Luego la propia respuesta hace `setConfigOverrides(...)` para hidratar `currentValue` en prompts que faltaban.
4. Ese `setConfigOverrides` vuelve a disparar el `useEffect` que recalcula.
5. Sin debounce, varios cambios encadenados o renders rápidos producen más llamadas idénticas.

## Cambios propuestos

### 1) Separar “hidratación interna” de “cambio real del usuario”
Añadir una `ref` de control en `PortalHome` para que cuando `fetchPrice` complete y haga `setConfigOverrides` con valores devueltos por la API, eso **no** dispare otro recálculo.

Ejemplo de enfoque:
- `isHydratingOverridesRef.current = true` antes de sembrar valores desde API
- `useEffect([configOverrides])` sale temprano si la actualización venía de hidratación interna
- después se vuelve a poner en `false`

Con eso se elimina la llamada duplicada generada por el propio frontend.

### 2) Debounce corto para cambios del usuario
Aplicar un debounce de ~300–400 ms al `useEffect` que observa `configOverrides`.

Eso agrupa:
- cambios rápidos de select
- escritura en inputs numéricos
- cascadas de actualización visual

Resultado: un solo `invoke("b2b-pricing")` tras la última interacción.

### 3) No volver a pedir si el body efectivo no cambió
Guardar una firma serializada del último request enviado (`catalog_item_id + overrides normalizados + skip_resolve`) en una `ref`.

Antes de llamar a `b2b-pricing`, comparar:
- si la firma es igual a la anterior, no llamar
- si cambió, sí llamar

Esto corta incluso repeticiones accidentales aunque haya más de un trigger en UI.

### 4) Endurecer el render del error transitorio
Mientras exista un cálculo más reciente en curso, no mostrar `pricingError` viejo.

Así evitamos el síntoma visual de:
- primero “Error de cálculo”
- luego precio correcto

## Archivo a tocar
- `src/pages/PortalHome.tsx`

## Qué no voy a tocar
- No cambiaré la edge function `supabase/functions/b2b-pricing/index.ts`.
- No cambiaré la lógica del motor EasyQuote.
- No tocaré la parte de creación de presupuestos.

## Validación
Después de implementarlo, comprobaré:

1. Abrir un producto del catálogo.
   - Debe salir 1 llamada útil, no 3 iguales.
2. Cambiar un prompt.
   - Debe salir 1 llamada tras la pausa del debounce.
3. Cambiar varios prompts rápido.
   - Debe agruparse y no mostrar el error transitorio si la última respuesta es correcta.

## Resultado esperado
- Desaparecen las 3 llamadas idénticas.
- Baja la presión sobre EasyQuote.
- El precio correcto aparece sin el falso error intermedio.