## Fase 1 — Auditoría + Quick Wins (≈150 créditos)

Orden de ejecución (de menor riesgo → mayor visibilidad). Te aviso antes de cada bloque y te enseño qué se va a tocar.

---

### Bloque 1 — Investigación previa (sin cambios) — ~5 créditos
Antes de tocar nada, identifico los 2 puntos críticos que no sabemos qué son:
1. Qué política RLS tiene `USING(true)` y en qué tabla.
2. Qué bucket es público y qué contiene.
3. Listado exacto de las ~25 funciones sin `search_path`.

**Entregable**: te paso un resumen con los nombres y te confirmo si alguno es intencional (ej. bucket `logos` probablemente sí debe ser público).

---

### Bloque 2 — Hardening de funciones SECURITY DEFINER — ~25 créditos
**Cambio**: 1 migración SQL que añade `SET search_path = public` a todas las funciones que no lo tengan.

**Riesgo**: muy bajo. Es una buena práctica de Supabase, no cambia comportamiento, solo evita ataques de search_path hijacking.

**Antes de aplicar** te enseño la lista completa de funciones afectadas.

---

### Bloque 3 — Revocar EXECUTE a `anon` en funciones internas — ~20 créditos
**Cambio**: 1 migración que revoca `EXECUTE` a roles `anon`/`public` en funciones SECURITY DEFINER que NO deben ser llamadas sin autenticación (ej. `get_user_credentials`, `set_user_credentials`, `create_organization_api_credential`, etc.).

**Riesgo**: bajo, pero requiere identificar bien cuáles SÍ deben quedar accesibles (ej. `validate_api_key` para webhooks externos).

**Antes de aplicar** te paso la lista marcando cuáles revoco y cuáles dejo abiertas, para que confirmes.

---

### Bloque 4 — Índices de BD faltantes — ~30 créditos
**Cambio**: 1 migración con índices en columnas de filtro frecuente:
- `sales_orders(organization_id, status)`, `sales_orders(customer_id)`
- `customers(organization_id, holded_id)`
- `product_prompt_settings(product_id, organization_id)`
- `quote_items(quote_id)` si no existe ya
- `api_performance_metrics(created_at)` para purga rápida

**Riesgo**: bajo (los índices solo aceleran). Antes de crear, verifico con `pg_indexes` cuáles ya existen para no duplicar.

**Beneficio esperado**: queries de listados de pedidos/clientes 3-10× más rápidas en tenants grandes.

---

### Bloque 5 — Política de retención `api_performance_metrics` — ~15 créditos
**Cambio**: 
- Migración que crea función `cleanup_old_api_metrics()` que borra registros >30 días.
- Programar ejecución (cron pg_cron si está disponible, o edge function diaria).

**Riesgo**: bajo. La tabla solo sirve para diagnóstico, no para histórico.

**Antes de aplicar** te confirmo el periodo de retención (30/60/90 días).

---

### Bloque 6 — Quick win UX visible: skeletons en listados — ~40 créditos
**Cambio (solo frontend, sin BD)**: añadir loading skeletons en:
- Listado de presupuestos (`/presupuestos`)
- Listado de pedidos (`/pedidos`)
- Listado de clientes (`/clientes`)
- Detalle de presupuesto/pedido durante carga inicial

Sustituye los spinners genéricos por skeletons que respetan el layout final → percepción de velocidad +30-50% sin tocar performance real.

**Riesgo**: muy bajo (solo UI).

---

### Resumen de créditos Fase 1
| Bloque | Créditos | Tipo |
|--------|----------|------|
| 1. Investigación | 5 | Lectura |
| 2. search_path | 25 | Migración |
| 3. Revocar EXECUTE | 20 | Migración |
| 4. Índices | 30 | Migración |
| 5. Retención métricas | 15 | Migración + edge fn |
| 6. Skeletons UX | 40 | Frontend |
| **Total** | **~135** | |

Quedan ~365 créditos para Fase 2 (CRM/recordatorios) y Fase 3 (pulido final).

---

### Cómo procedo
1. Ejecuto **Bloque 1** ya (solo lectura, sin cambios) y te paso el informe.
2. Tras tu OK, voy bloque a bloque, mostrándote SQL/diff antes de aplicar.
3. Si algún bloque no te convence, lo saltamos y reasignamos créditos.

¿Apruebo el plan y arranco con el Bloque 1 (investigación)?