## Objetivo

Cambiar el texto visible del estado `sent` (presupuestos) de **"Enviado"** a **"Listo para enviar"** en toda la interfaz, sin tocar el valor interno en BD (`status = 'sent'`) ni la lógica de exportación a Holded.

## Alcance

Sólo cambios de copy en los puntos donde la etiqueta del estado se muestra al usuario. NO se tocan:
- Valor `'sent'` en BD ni en queries.
- Triggers (`set_quote_status_timestamps`) ni timestamps `sent_at`.
- Lógica de Holded (`canExportQuotesOnSend`, etc.).
- Textos que se refieren a la **acción/momento** de envío al cliente (ej. "Enviado: dd/mm/yyyy hh:mm" en cards y listados — eso es la fecha real en que se envió por email, no la etiqueta del estado).

## Archivos a editar

1. **`src/pages/QuotesList.tsx`** (línea 29)
   - Mapa `STATUS_LABELS`: `sent: "Enviado"` → `sent: "Listo para enviar"`.
   - Línea 491 (`Enviado: <fecha>`): se mantiene, es la fecha de envío real.

2. **`src/pages/QuoteEdit.tsx`** (línea 133)
   - Mapa de labels: `sent: "Enviado"` → `sent: "Listo para enviar"`.

3. **`src/pages/QuoteDetail.tsx`**
   - Línea 53 (`case 'sent': return 'Enviado'`) → `'Listo para enviar'`.
   - Línea 666 (tooltip): `"Para aprobar el presupuesto, primero debes cambiarlo a estado 'Enviado'"` → `"Para aprobar el presupuesto, primero debes cambiarlo a estado 'Listo para enviar'"`.

4. **`src/pages/PortalQuote.tsx`** (línea 167)
   - Badge de estado para el cliente: `"Enviado"` → `"Listo para enviar"`.
   - Línea 306 (`Enviado desde {organization.name}`): se mantiene, es otra cosa (footer "enviado desde X").

5. **`src/pages/Index.tsx`** (línea 208)
   - Tarjeta del dashboard que cuenta presupuestos en estado `sent`: label `"Enviado"` → `"Listo para enviar"`.

6. **`src/components/quotes/QuoteCard.tsx`** (línea 91)
   - `Enviado: <fecha>` → se mantiene, es la fecha real de envío al cliente, no el estado.

## Qué NO cambia

- Botones de acción tipo "Enviar al cliente", "Marcar como enviado", etc. siguen usando su propio copy (no son la etiqueta del estado).
- La fecha `sent_at` mostrada como "Enviado: dd/mm/yyyy" se queda igual porque ahí "Enviado" es participio referido al evento de envío real, no al nombre del estado.
- Memorias y docs internos siguen referenciando `sent` como identificador técnico.

## Verificación

Tras aplicar los cambios, comprobar visualmente en `/presupuestos`:
- Badge en lista de presupuestos.
- Filtro/columna de estado.
- Detalle de un presupuesto en estado `sent`.
- Dashboard (`/`) tarjeta "Listo para enviar".
- Portal cliente.
