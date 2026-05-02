# Fix: Error al crear presupuesto agrupado

## Diagnóstico

El error **"Failed to send a request to the Edge Function"** se produce **antes** de que la función `create-grouped-quote` se ejecute. Lo confirmo porque no hay ningún log de la función en Supabase. Es un fallo de red (probable causa: la edge function no está desplegada, CORS mal configurado, o el cliente no logra alcanzarla).

Revisando `supabase/functions/create-grouped-quote/index.ts` veo dos problemas concretos:

1. **CORS incompleto**: faltan headers que el SDK de Supabase envía por defecto (`x-supabase-client-platform`, `x-supabase-client-runtime`, etc.). Si el preflight OPTIONS rechaza la petición, el SDK reporta exactamente este mensaje.
2. **Posible desincronización del despliegue**: la función se creó en el último build pero puede no estar disponible aún en el endpoint público.

## Cambios a realizar

### 1. Corregir CORS de la edge function
En `supabase/functions/create-grouped-quote/index.ts` ampliar el `Access-Control-Allow-Headers` para aceptar todos los headers que envía `supabase.functions.invoke()`:

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-organization-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

### 2. Re-desplegar la función
Forzar el redeploy de `create-grouped-quote` para asegurar que el endpoint está disponible y con la nueva config CORS.

### 3. Mejorar el manejo de errores en el frontend
En `src/pages/GroupedQuoteNew.tsx`, función `handleCreate`: mostrar un mensaje más útil cuando `error.message` es genérico ("Failed to send a request..."), indicando al usuario que reintente y que revise consola.

### 4. Verificación
Después del fix:
- Probar manualmente la creación con un par de items.
- Comprobar logs de la edge function para confirmar ejecución.

## Qué NO se toca

- Lógica de negocio de la función (deep copy, marcar origen como `grouped`, etc.) — funciona correctamente, no llegó a ejecutarse.
- Esquema de base de datos — ya está bien aplicado.
- UI de selección — funciona, el problema es solo en la llamada final.

## Tiempo estimado
Cambio puntual y rápido: editar CORS, redeploy, y probar.
