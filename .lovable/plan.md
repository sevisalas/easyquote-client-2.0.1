

## Plan: Añadir logging de valores numéricos en easyquote-pricing

### Cambio único

**Archivo**: `supabase/functions/easyquote-pricing/index.ts`

En la línea donde se loguean los outputValues DETAILS (~línea 220), añadir los campos de valor al mapeo:

```typescript
// Antes:
label: o.label || o.name || o.outputText,
nameCell: o.nameCell, valueCell: o.valueCell, ...

// Después - añadir:
value: o.value ?? o.result ?? o.calculatedValue ?? o.formattedValue,
```

Esto permitirá ver en los logs algo como:
```
{"idx":1, "label":"Precio", "value": 1450.50}
```

### Resultado
Después de desplegar, al recalcular el artículo verás los precios exactos de cada componente (Encuadernado, Interior, Cubierta) directamente en los logs del edge function.

