

## Plan: Tarifa de cliente (descuento automático post-cálculo)

### Requisito clave de visibilidad
Los descuentos de cliente son **solo visibles para administradores**. No se muestran:
- En el PDF del presupuesto (el cliente no los ve)
- En la UI para usuarios con rol gestor, comercial u operador
- En las exportaciones a Holded (se integran en el precio silenciosamente)

Funcionan como los `item_additionals` con `hideItemAdjustmentsInPdf`: se aplican al precio pero no aparecen como línea visible.

### Modelo de datos

Nueva tabla `customer_discounts`:

```text
customer_discounts
├── id (uuid, PK)
├── customer_id (uuid, FK → customers, ON DELETE CASCADE)
├── organization_id (uuid, FK → organizations)
├── name (text)              -- "Descuento mayorista"
├── percentage (numeric)     -- Valor (ej: 10 = 10%)
├── is_discount (boolean)    -- true = resta, false = suma
├── is_active (boolean)      -- default true
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

- RLS: solo miembros de la organización con rol `admin`
- Se aplica siempre sobre el total (sin `applies_to` por ahora, simplificamos)

### Cambios en la app

**1. Formulario de cliente** (`ClienteForm.tsx`)
- Nueva sección "Descuentos / Tarifas" visible solo para admins
- CRUD inline: nombre, porcentaje, es descuento, activo/inactivo
- Solo se muestra después de crear el cliente (necesita `customer_id`)

**2. Presupuestos** (`QuoteNew.tsx`, `QuoteEdit.tsx`)
- Al seleccionar un cliente, cargar sus descuentos activos
- Aplicar el porcentaje sobre el subtotal de artículos para calcular el total
- **No inyectar como quote_additional visible** — se aplica internamente al precio final
- Solo admins ven el desglose del descuento en la UI (badge "Tarifa cliente: -10%")
- Para no-admins: el precio final ya incluye el descuento, sin indicación visible

**3. PDF y exportaciones**
- El descuento NO aparece como línea en el PDF
- El precio final en el PDF ya incluye el descuento aplicado
- En Holded: el descuento se integra en el precio, no como línea separada

**4. Hook `useCustomerDiscounts`**
- CRUD para la tabla `customer_discounts`
- Query filtrada por `customer_id` y `organization_id`
- Función `getActiveDiscounts(customerId)` para presupuestos

### Pasos de implementación

1. Migración: crear tabla `customer_discounts` con RLS (solo admin)
2. Hook `useCustomerDiscounts` para CRUD
3. Sección de descuentos en `ClienteForm.tsx` (solo admins)
4. Cargar y aplicar descuentos en `QuoteNew.tsx` y `QuoteEdit.tsx`
5. Ajustar cálculo de totales (aplicar % internamente)
6. Verificar que PDFs y exportaciones no muestran el descuento como línea

### Seguridad
- RLS: SELECT/INSERT/UPDATE/DELETE solo para miembros con rol admin de la organización
- UI: la sección se oculta si `membership.role !== 'admin'`
- El descuento se aplica al precio pero nunca se expone en documentos externos

