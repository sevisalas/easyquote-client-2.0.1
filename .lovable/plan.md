## Paso 1 — Marca de "acceso al portal" en la ficha del cliente

Objetivo: que el tenant pueda activar/desactivar el acceso al portal **por cliente**, sin crear todavía la cuenta de login. Solo la marca + el botón en la ficha.

### Qué se hace

1. **DB — añadir flag al cliente**
   - Migración sobre `customers`:
     - `portal_enabled boolean NOT NULL DEFAULT false`
     - `portal_enabled_at timestamptz NULL`
     - `portal_enabled_by uuid NULL` (usuario que lo activó, sin FK a `auth.users`)
   - No se crean tablas nuevas todavía. La cuenta de login va en el siguiente paso.
   - RLS: las políticas existentes de `customers` ya cubren el update del propio tenant, no se tocan.

2. **UI — ficha del cliente (`ClienteForm`, ruta `/clientes/:id/editar`)**
   - Nueva sección "Portal del cliente", visible **solo si** `usePortalAccess().hasPortalAccess === true` (el flag de la organización ya existe, `organizations.client_portal`).
   - Si el cliente NO tiene email → la sección se ve pero el botón está deshabilitado con aviso "Añade un email para poder activar el acceso".
   - Si `portal_enabled = false`: botón **"Activar acceso al portal"**.
   - Si `portal_enabled = true`: badge verde "Acceso activo desde {fecha}" + botón **"Revocar acceso"** (secundario).
   - Activar/revocar = simple `update` sobre `customers` (`portal_enabled`, `portal_enabled_at`, `portal_enabled_by = auth.uid()`).
   - En esta fase **no se envía email ni se crea usuario**. Solo es la marca.

3. **Listado de clientes**
   - En `ClientCard` (cuando `hasPortalAccess`): pequeño icono/badge si `portal_enabled = true`, para identificar de un vistazo qué clientes ya tienen el acceso marcado.

### Lo que NO se hace en este paso
- No se crea cuenta en `auth.users` para el cliente.
- No se envía email de bienvenida/contraseña.
- No se crean rutas `/portal/login` ni `/portal` (home con lista de presupuestos).
- No se toca el flujo actual del enlace por token de un presupuesto concreto (sigue funcionando igual).

Esos puntos van en el **Paso 2** (cuenta + email) y **Paso 3** (login + home con todos los presupuestos), una vez confirmes este.

### Detalles técnicos
- Migración: `ALTER TABLE public.customers ADD COLUMN portal_enabled boolean NOT NULL DEFAULT false, ADD COLUMN portal_enabled_at timestamptz, ADD COLUMN portal_enabled_by uuid;`
- Tras la migración, `src/integrations/supabase/types.ts` se regenera solo.
- El update se hace desde el cliente con el SDK de Supabase, protegido por las RLS ya existentes de `customers`.
