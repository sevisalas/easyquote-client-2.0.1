# Memory: features/portal/client-portal-architecture
Updated: now

El Portal del Cliente permite a los clientes ver presupuestos online y aprobarlos/rechazarlos desde un enlace seguro enviado por email. Se habilita a nivel de organización mediante el flag `client_portal` en `organization_integration_access`.

**Tablas**: `quote_portal_tokens` (tokens UUID con expiración de 30 días) y `quote_portal_actions` (registro de acciones: viewed, approved, rejected, commented con IP y timestamp).

**Edge Function**: `portal-quote` — endpoint público (sin JWT) que valida tokens, sirve datos del presupuesto con branding de la org (GET), y registra acciones del cliente (POST). Al aprobar/rechazar, actualiza `quotes.status` y desactiva el token.

**Frontend**: Ruta pública `/portal/:token` fuera de ProtectedRoute. Muestra presupuesto con colores corporativos de la organización, tabla de items, y botones de aprobar/rechazar.

**Email**: `send-quote-email` genera un token automáticamente cuando `client_portal` está habilitado. El CTA principal del email apunta al portal; el PDF queda como enlace secundario. Variable de plantilla `{{boton_portal}}` disponible.

**Backoffice**: Toggle en IntegrationAccess para activar/desactivar por org. Indicador visual en QuoteDetail mostrando actividad del portal (visto, aprobado, rechazado). Hook `usePortalAccess` para comprobar si la org tiene portal activo.
