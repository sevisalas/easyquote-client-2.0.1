

## Plan: Gráficos en dashboard + Envío de presupuestos por email

### Resumen

Dos bloques de trabajo:

1. **Gráficos en el dashboard principal** (Index.tsx) - usando recharts (ya instalado)
2. **Envío de presupuestos por email** desde la vista de detalle del presupuesto, usando el sistema de email integrado de Lovable

---

### Bloque 1: Gráficos en el dashboard

Se añadirá una nueva sección "Métricas" debajo de las tarjetas de estadísticas actuales, con tres gráficos:

**1.1 Presupuestos por mes y tasa de conversión**
- Gráfico de barras agrupadas: creados vs aprobados por mes (últimos 6 meses)
- Línea superpuesta con el % de conversión (aprobados/total)
- Query: `quotes` agrupando por `created_at` mes y `status`

**1.2 Facturación por periodo**
- Gráfico de línea/área con el valor total (`final_price`) de presupuestos aprobados por mes
- Últimos 6 meses

**1.3 Actividad por usuario/comercial**
- Gráfico de barras horizontal: ranking de usuarios por cantidad de presupuestos creados
- Query: `quotes` agrupando por `user_id`, cruzando con `organization_members.display_name`

**Archivos a crear/modificar:**
- `src/components/dashboard/DashboardCharts.tsx` (nuevo) - componente con los 3 gráficos
- `src/pages/Index.tsx` - integrar el componente entre las stats y las quick actions

---

### Bloque 2: Envío de presupuestos por email

Requiere configurar primero el dominio de email del proyecto. Como no hay dominio configurado aún, el flujo será:

**2.1 Configurar dominio de email**
- Se mostrará el diálogo de configuración de dominio de email

**2.2 Configurar infraestructura de email**
- Setup de la infraestructura (colas, Edge Functions)
- Scaffold de email transaccional

**2.3 Crear plantilla de email**
- Template `quote-sent` en React Email con el estilo de la app
- Incluirá: nombre del cliente, numero de presupuesto, precio total, y el PDF como link de descarga (se sube a Supabase Storage y se incluye enlace)

**2.4 Botón "Enviar por email" en QuoteDetail**
- Nuevo botón en la barra de acciones del presupuesto
- Al pulsar: genera el PDF, lo sube a Storage, invoca `send-transactional-email` con la plantilla `quote-sent` y el email del cliente
- Validación: el cliente debe tener email configurado

**Archivos a crear/modificar:**
- `supabase/functions/_shared/transactional-email-templates/quote-sent.tsx` (nuevo)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (modificar)
- `src/pages/QuoteDetail.tsx` - añadir botón de envío por email
- Página de unsubscribe (ruta a determinar por el scaffold)

---

### Orden de implementación

1. Gráficos del dashboard (sin dependencias externas, se puede hacer ya)
2. Configuración de dominio de email (requiere tu intervención para configurar DNS)
3. Plantilla y botón de envío (tras verificar el dominio)

### Notas

- Las notificaciones se dejan para futuras peticiones de cada tenant, como indicaste
- Los gráficos respetan el RBAC existente: cada usuario ve solo los datos que sus políticas RLS permiten
- El email solo se envía si el cliente tiene dirección de correo configurada

