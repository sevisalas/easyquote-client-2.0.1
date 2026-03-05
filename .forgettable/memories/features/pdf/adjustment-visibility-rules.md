# Memory: features/pdf/adjustment-visibility-rules
Updated: 2026-03-05

## Reglas de visibilidad de ajustes para Templates 7/8 (Campillo/Anebri)

### Ajustes de ARTÍCULO (item_additionals)
- **PDF**: NO se muestran (se ocultan, se integran en el precio del artículo)
- **Holded**: NO se suben como líneas separadas (se integran en el precio del artículo)
- Los valores se suman al precio base del producto silenciosamente

### Ajustes de PRESUPUESTO (quote_additionals)
- **PDF**: SÍ se muestran como filas al final de la tabla de items
- **Holded**: SÍ se suben como líneas separadas (descuentos como descuentos)
- Si están marcados como descuento (is_discount), se aplican como descuento global

### Nota técnica
- `hideItemAdjustmentsInPdf`: controla si los item_additionals se ocultan en el PDF
- `hideItemAdjustmentsInHolded`: controla si los item_additionals se muestran en la descripción del artículo en Holded
- `hideAdjustmentsInHolded`: ahora siempre `false` - los quote_additionals siempre se muestran como líneas separadas
- En multi-quantity PDFs, los ajustes se recalculan dinámicamente para cada tier (Q2, Q3)
