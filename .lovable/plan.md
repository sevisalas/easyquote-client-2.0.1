

# Centro de herramientas técnicas para SuperAdmin

## Contexto del problema

Actualmente existe información técnica muy valiosa dispersa en la aplicación que solo debería ser accesible para roles técnicos (desarrollador, soporte, arquitecto), pero no está organizada ni es accesible de forma centralizada:

- **ProductTestPage**: Tiene panel de debug de prompts y diagnóstico de productos, pero está mezclado con la UI de usuario normal
- **EasyQuoteConnectivityTest**: Test de conectividad API que existe pero no está expuesto en ninguna UI
- **RealMetricsDashboard**: Métricas del sistema ya integradas en SuperAdmin
- **Edge functions de diagnóstico**: `test-product-info`, `test-easyquote-connectivity` disponibles pero sin UI dedicada

## Propuesta: Panel de herramientas técnicas

Crear una sección dedicada `/superadmin/herramientas` (o "Área técnica") con pestañas/secciones para diferentes necesidades:

### 1. Diagnóstico de productos (tu necesidad inmediata)
- Selector de organización (impersonación)
- Probar cálculos de productos con el contexto de esa organización
- Ver prompts raw de la API
- Ejecutar diagnóstico de errores

### 2. Conectividad y estado del sistema
- Test de conectividad con API EasyQuote
- Estado de los endpoints principales
- Verificación de credenciales por organización

### 3. Logs y trazabilidad (futuro)
- Historial de errores por organización
- Llamadas fallidas a la API
- Tiempos de respuesta por endpoint

### 4. Datos de organizaciones (análisis)
- Ver productos configurados por organización
- Estadísticas de uso
- Configuraciones activas (integraciones, planes)

### 5. Herramientas de soporte (futuro)
- Regenerar tokens de organización
- Verificar configuración de credenciales
- Forzar sincronización de datos

---

## Perfiles técnicos y sus necesidades

| Perfil | Necesita | Herramienta |
|--------|----------|-------------|
| **Desarrollador** | Debuggear prompts, ver respuestas raw | Panel de debug, logs API |
| **Soporte técnico** | Diagnosticar errores de clientes | Impersonación + diagnóstico |
| **Arquitecto** | Entender flujos, métricas | Dashboard métricas, trazabilidad |
| **QA/Testing** | Probar productos en contextos distintos | Impersonación + test productos |
| **Usuario avanzado interno** | Ver estado del sistema | Conectividad, estado general |

---

## Implementación propuesta (Fase 1)

### Nueva página: SuperAdminToolsPage

Ubicación: `/superadmin/herramientas`

Contenido inicial:
1. **Selector de organización** - Dropdown con todas las organizaciones
2. **Pestañas principales**:
   - "Productos" - ProductTestPage embebido con herramientas de debug visibles
   - "Conectividad" - EasyQuoteConnectivityTest con contexto de la org seleccionada
   - "Métricas" - Enlace o embebido del RealMetricsDashboard (ya existe)

### Cambios en el sidebar

Añadir entrada en el menú SuperAdmin:
```
SuperAdmin
├── Dashboard
├── Planes
├── Suscriptores
├── Integraciones
├── SuperAdmins
├── Roadmap
├── Solicitudes
└── [NUEVO] Herramientas técnicas  <-- Acceso a /superadmin/herramientas
```

### Cambios en ProductTestPage

- Mantener la página actual para usuarios normales (sin debug)
- Cuando se accede desde `/superadmin/herramientas`:
  - Mostrar selector de organización en la parte superior
  - Mostrar todas las herramientas de debug
  - Usar las credenciales de la organización seleccionada para las llamadas API

---

## Cambios técnicos requeridos

### 1. Base de datos (migración SQL)

Nueva función RPC para que SuperAdmin pueda obtener credenciales de cualquier organización:

```sql
CREATE OR REPLACE FUNCTION get_organization_easyquote_credentials_for_superadmin(
  p_organization_id uuid
)
RETURNS TABLE(api_username text, api_password text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario actual es superadmin
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT 
    c.api_username::text,
    c.api_password::text
  FROM easyquote_credentials c
  JOIN organizations o ON o.api_user_id = c.user_id
  WHERE o.id = p_organization_id
  LIMIT 1;
END;
$$;
```

### 2. Edge function: easyquote-refresh-token

Modificar para aceptar `organization_id` opcional:

- Si el usuario es superadmin y pasa `organization_id`:
  - Usar la nueva RPC para obtener credenciales de esa organización
  - Generar token con esas credenciales
- Si no:
  - Comportamiento actual (credenciales del usuario autenticado)

### 3. Frontend: SubscriptionContext

Añadir:
- `allOrganizations: Organization[]` - Lista de todas las organizaciones (solo para superadmin)
- `impersonatedOrgId: string | null` - ID de organización impersonada
- `setImpersonatedOrgId(id)` - Función para cambiar
- `getEffectiveOrgId()` - Retorna impersonatedOrgId si existe, sino el normal

### 4. Nueva página: SuperAdminToolsPage

Componente con:
- Selector de organización (usando allOrganizations)
- Tabs: Productos | Conectividad | (futuro: más)
- Embebe ProductTestPage pasando el orgId como prop

### 5. ProductTestPage modificado

- Añadir prop opcional `overrideOrganizationId?: string`
- Usar ese ID en lugar del de SubscriptionContext cuando esté presente
- Mostrar herramientas de debug cuando viene de contexto superadmin

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/pages/SuperAdminTools.tsx` | NUEVO - Página principal de herramientas |
| `src/components/superadmin/OrgSelector.tsx` | NUEVO - Selector reutilizable de organizaciones |
| `src/contexts/SubscriptionContext.tsx` | MODIFICAR - Añadir impersonación y lista de orgs |
| `src/pages/ProductTestPage.tsx` | MODIFICAR - Aceptar orgId override, condicionar debug |
| `src/components/AppSidebar.tsx` | MODIFICAR - Añadir entrada "Herramientas técnicas" |
| `src/App.tsx` | MODIFICAR - Añadir ruta /superadmin/herramientas |
| `supabase/functions/easyquote-refresh-token/index.ts` | MODIFICAR - Aceptar organization_id |
| Nueva migración SQL | NUEVO - RPC para credenciales de superadmin |

---

## Flujo de uso

1. SuperAdmin entra a `/superadmin/herramientas`
2. Ve un selector con todas las organizaciones del sistema
3. Selecciona "Imprenta Campillo"
4. El sistema:
   - Guarda `impersonatedOrgId` en sessionStorage
   - Obtiene token de EasyQuote usando credenciales de Campillo (server-side, seguro)
5. Puede navegar por la pestaña "Productos":
   - Ve los productos de Campillo
   - Puede probar cálculos
   - Ve el panel de debug con prompts raw
   - Puede ejecutar diagnósticos
6. Si cambia a otra organización, el proceso se repite

---

## Seguridad

- Las credenciales NUNCA viajan al frontend
- La RPC de credenciales solo es accesible por superadmins (verificación server-side)
- El token generado es temporal (como siempre)
- La impersonación solo afecta a las herramientas técnicas, no permite modificar datos de la organización

