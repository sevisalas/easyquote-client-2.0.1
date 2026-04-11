

## Plan: Portal del Cliente — Fase 1

### Objetivo
Permitir que los clientes vean sus presupuestos online y los aprueben/rechacen directamente desde un enlace seguro enviado por email. Habilitado a nivel de tenant (organización).

### Arquitectura

```text
┌─────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  Email con  │────▶│ /portal/:token   │────▶│  Vista presupuesto   │
│  botón CTA  │     │ (ruta pública)   │     │  + Aprobar/Rechazar  │
└─────────────┘     └──────────────────┘     └──────────────────────┘
                            │
                    ┌───────▼────────┐
                    │ Edge Function  │
                    │ portal-quote   │
                    │ (valida token) │
                    └────────────────┘
```

### Componentes del plan

**1. Base de datos — 2 tablas nuevas + 1 columna**

- **`quote_portal_tokens`**: almacena tokens de acceso temporal por presupuesto
  - `id`, `quote_id` (FK), `token` (UUID único), `expires_at`, `created_at`, `accessed_at`, `is_active`
  - RLS: solo lectura vía service role (la Edge Function valida)

- **`quote_portal_actions`**: registro de acciones del cliente (aprobar, rechazar, comentar)
  - `id`, `quote_id`, `token_id`, `action` (approved/rejected/commented), `comment`, `client_ip`, `created_at`

- **`organization_integration_access`**: añadir columna `client_portal` (boolean, default false)
  - Controla si la org tiene habilitado el portal

**2. Edge Function — `portal-quote`**
- Endpoint público (sin JWT) que valida el token
- GET: devuelve datos del presupuesto (items, precios, nombre org, logo, colores)
- POST: registra acción del cliente (aprobar/rechazar/comentar)
- Al aprobar, actualiza `quotes.status` a `approved` y dispara la lógica existente

**3. Frontend — Página pública `/portal/:token`**
- Ruta fuera del `ProtectedRoute` (accesible sin login)
- Muestra presupuesto con branding de la organización (logo, colores del tema)
- Tabla de items con descripción, cantidad, precio
- Botones: "Aprobar presupuesto" / "Rechazar" + campo de comentarios
- Estado de confirmación tras la acción
- Diseño responsive (el cliente lo abrirá desde móvil)

**4. Integración con email existente**
- Modificar `send-quote-email` para generar un token y usar la URL del portal como CTA principal (en lugar del PDF directo)
- El PDF sigue disponible como enlace secundario

**5. Gestión en el backoffice**
- Toggle en IntegrationAccess para habilitar/deshabilitar `client_portal` por organización
- En QuoteDetail: indicador visual cuando el cliente ha visto/aprobado/rechazado desde el portal
- Hook `usePortalAccess` similar a `usePdfAccess`

### Detalles técnicos

- Los tokens son UUIDs con expiración configurable (30 días por defecto)
- Cada token es de un solo presupuesto — no da acceso a nada más
- No se requiere autenticación del cliente (acceso por token)
- Las acciones quedan registradas con IP y timestamp para trazabilidad
- La página del portal usa los colores del tema corporativo de la organización (`organization_themes`)

### Orden de implementación
1. Migración DB (tablas + columna)
2. Edge Function `portal-quote`
3. Página pública `/portal/:token`
4. Modificar `send-quote-email` para generar token y enlace al portal
5. Toggle en backoffice + indicadores en QuoteDetail

