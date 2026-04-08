

## Campo "Indicaciones" por artículo en pedidos

### Cambios

**1. Base de datos** — nueva columna `instructions` (text, nullable) en `sales_order_items`

**2. `src/pages/SalesOrderDetail.tsx`**
- Añadir un bloque editable con label **"Indicaciones"** dentro de cada artículo desplegado (entre la descripción y el WorkOrderItem)
- Textarea inline: click para editar, guardar al confirmar
- Solo editable antes de producción (vista administrativa)

**3. `src/components/production/WorkOrderItem.tsx`**
- Nueva prop `instructions?: string`
- Mostrar bloque **"Indicaciones"** justo antes de "Observaciones", destacado visualmente, solo si tiene contenido

**4. `src/utils/workOrderPdfGenerator.tsx`**
- Incluir "Indicaciones" en el PDF de la orden de trabajo si existe

### Terminología UI
- Label: **"Indicaciones"** (sin "especiales", sin mayúsculas innecesarias)

