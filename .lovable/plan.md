

# Fix: Token refresh para superadmin sin credenciales propias

## Problema
Cuando un superadmin inicia sesion, `completeLogin()` llama a `easyquote-refresh-token` sin pasar `organization_id`. El RPC `get_organization_easyquote_credentials(p_user_id)` busca credenciales por el user_id del superadmin, pero este no es owner ni member de ninguna organizacion, asi que devuelve vacio y la edge function responde 404.

Aunque el codigo ya tiene un `console.warn` para este caso, el error 404 se reporta como runtime error y puede causar problemas visuales (blank screen).

## Solucion

### 1. Modificar `completeLogin` en `Auth.tsx`
- Pasar el `organization_id` seleccionado (de `sessionStorage`) al body de la llamada a `easyquote-refresh-token`
- Esto permite que superadmins con organizacion seleccionada obtengan el token correcto
- Para superadmins sin organizacion, el error se maneja silenciosamente sin mostrar toast de error

### 2. Modificar `refreshEasyQuoteToken` en `easyquoteApi.ts`
- Leer `selected_organization_id` de `sessionStorage`
- Si existe, pasarlo como `organization_id` en el body de la llamada
- Esto corrige tambien el auto-refresh cuando el token expira durante la sesion

## Cambios por archivo

### `src/pages/Auth.tsx` (linea ~144)
Pasar organization_id al body:
```typescript
const orgId = sessionStorage.getItem('selected_organization_id');
const { data, error: fxError } = await supabase.functions.invoke("easyquote-refresh-token", {
  body: orgId ? { organization_id: orgId } : {}
});
```

### `src/lib/easyquoteApi.ts` (funcion `refreshEasyQuoteToken`, linea ~24)
Incluir organization_id en el refresh automatico:
```typescript
const orgId = sessionStorage.getItem('selected_organization_id');
const { data, error } = await supabase.functions.invoke("easyquote-refresh-token", {
  body: orgId ? { organization_id: orgId } : {},
});
```

## Detalle tecnico
La edge function `easyquote-refresh-token` ya soporta `organization_id` en el body -- lo usa para la impersonacion de superadmin (via `get_organization_easyquote_credentials_for_superadmin`). Sin embargo, para usuarios normales, el `organization_id` no se utiliza actualmente. El cambio propuesto solo afecta al lado cliente, enviando el contexto de organizacion que ya existe en sessionStorage.

Para el superadmin especificamente, cuando pasa `organization_id`, la edge function ya verifica el rol superadmin y usa el RPC correcto. Esto ya funciona en `SuperAdminTools.tsx`.
