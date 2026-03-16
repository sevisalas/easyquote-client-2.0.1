

## Plan: Numeración jerárquica de OT (solo si hay más de un artículo)

### Lógica

- **1 artículo**: todo queda como está, sin cambios visuales.
- **>1 artículo**: en el header derecho del PDF y en el componente visual:
  - Línea secundaria (fontSize 9, color gris): `Pedido: OT-{orderNumber}`
  - Línea principal destacada (fontSize 14, bold): `OT-{orderNumber}/{itemIndex+1}`

### Cambios

**1. `src/utils/workOrderPdfGenerator.tsx` — Header derecho (líneas 462-464)**

Reemplazar la línea fija `<Text style={styles.otNumber}>{orderNumber}</Text>` con lógica condicional:

```tsx
{items.length > 1 ? (
  <>
    <Text style={{ fontSize: 9, color: '#666' }}>Pedido: {orderNumber}</Text>
    <Text style={styles.otNumber}>{orderNumber}/{itemIndex + 1}</Text>
  </>
) : (
  <Text style={styles.otNumber}>{orderNumber}</Text>
)}
```

**2. `src/components/production/WorkOrderItem.tsx` — Header visual (línea ~70)**

Añadir props `totalItems` y actualizar el header:
- Si `totalItems > 1`: mostrar "Pedido: OT-{orderNumber}" en texto pequeño gris + "OT-{orderNumber}/{itemIndex+1}" en bold.
- Si `totalItems === 1`: mantener como está.

Actualizar los sitios que consumen `WorkOrderItem` para pasar `totalItems`.

**3. Nombre del fichero PDF** — Sin cambios, se mantiene `OT-{orderNumber}.pdf`.

### Archivos a modificar
- `src/utils/workOrderPdfGenerator.tsx`
- `src/components/production/WorkOrderItem.tsx`
- Cualquier padre que renderice `WorkOrderItem` (para pasar `totalItems`)

