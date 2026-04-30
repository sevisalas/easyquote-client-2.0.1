# Renombrar estado `sent` → "Preparado"

Cambio puramente de etiqueta visible. El valor interno en BD sigue siendo `sent`. No afecta lógica, filtros, Holded, ni emails.

## Archivos a modificar

1. **`src/pages/QuotesList.tsx`** (línea 29)
   - `sent: "Listo para enviar"` → `sent: "Preparado"`

2. **`src/pages/QuoteEdit.tsx`** (línea 133)
   - `sent: "Listo para enviar"` → `sent: "Preparado"`

3. **`src/pages/QuoteDetail.tsx`**
   - Línea 53: `case 'sent': return 'Listo para enviar'` → `'Preparado'`
   - Línea 666: tooltip actualizado a *"Para aprobar el presupuesto, primero debes cambiarlo a estado 'Preparado'"*

4. **`src/pages/PortalQuote.tsx`** (línea 167)
   - Badge de estado en el portal del cliente: `"Listo para enviar"` → `"Preparado"`

5. **`src/pages/Index.tsx`** (línea 208)
   - Tarjeta KPI del dashboard: `"Listo para enviar"` → `"Preparado"`

## Lo que NO se toca

- Valor en BD (`status = 'sent'`): sin migración.
- Botones de acción ("Marcar como preparado" / "Enviar") ya ajustados previamente.
- Plantillas de email y SMTP.
- Lógica de transición de estados, RLS, ni reglas de bloqueo de aprobación.
