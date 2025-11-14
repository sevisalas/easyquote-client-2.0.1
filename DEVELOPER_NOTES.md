# Notas de Desarrollo - EasyQuote

## Reglas de Negocio Críticas

### 1. Sistema de Productos
- **NUNCA usar cantidades fijas**: Todos los productos provienen del API de EasyQuote
- **Flujo de datos obligatorio**: `prompts` → `outputs` → `multi` → `price`
- Los productos tienen configuraciones dinámicas basadas en respuestas del usuario
- El precio se calcula en base a las selecciones en `prompts`, `outputs` y `multi`

### 2. Presupuestos y Pedidos
- **Los pedidos son una réplica exacta de presupuestos**
- Misma funcionalidad, mismo flujo, mismos componentes
- Un pedido puede crearse desde un presupuesto o desde cero
- Ambos comparten la misma estructura de artículos con prompts/outputs/multi

### 3. Componentes Obligatorios

#### QuoteItem (src/components/quotes/QuoteItem.tsx)
- **SIEMPRE usar este componente** para editar productos en presupuestos y pedidos
- **NUNCA crear diálogos simples** con solo cantidad/precio
- Este componente maneja:
  - Selección de producto del API
  - Configuración de prompts (preguntas del producto)
  - Configuración de outputs (acabados/opciones)
  - Configuración de multi (cantidades múltiples)
  - Cálculo automático de precio

#### Estructura de uso en edición:
```tsx
{items.map((item) => (
  <QuoteItem
    key={item.id}
    item={item}
    onChange={handleItemChange}
    onFinish={handleItemFinish}
    onRemove={handleRemoveItem}
  />
))}
```

### 4. Estructura de Datos de Artículos

#### Presupuestos (quote_items)
```typescript
{
  id: uuid
  quote_id: uuid
  product_id: string        // ID del producto en EasyQuote API
  product_name: string
  prompts: jsonb           // Respuestas a preguntas del producto
  outputs: jsonb           // Acabados/opciones seleccionados
  multi: jsonb             // Cantidades múltiples
  price: number            // Calculado automáticamente
  quantity: number         // Total de unidades
  position: number         // Orden en la lista
}
```

#### Pedidos (sales_order_items)
Misma estructura que quote_items, solo cambia `quote_id` por `sales_order_id`

### 5. Flujo de Trabajo con API

1. Usuario selecciona producto del API EasyQuote
2. QuoteItem carga las preguntas (prompts) del producto
3. Usuario responde preguntas
4. Se cargan outputs disponibles según respuestas
5. Usuario configura cantidades (multi)
6. API calcula precio automáticamente
7. Se guarda todo en JSONB (prompts, outputs, multi)

### 6. Adicionales (Additionals)

- Pueden ser cargos o descuentos
- Tipos: `fixed` (fijo) o `percentage` (porcentaje)
- Se aplican al subtotal del presupuesto/pedido
- Se gestionan con componentes dedicados: `QuoteAdditionalsSelector`, `AdditionalsSelector`

### 7. Patrones a EVITAR

❌ **NO hacer esto:**
- Diálogos simples con solo cantidad/precio para editar productos
- Cantidades fijas sin prompts/outputs/multi
- Bypass del sistema de configuración de productos
- Edición directa de precios sin recalcular desde API

✅ **SÍ hacer esto:**
- Usar QuoteItem para toda edición de productos
- Mantener sincronización con EasyQuote API
- Guardar prompts/outputs/multi en JSONB
- Respetar el flujo completo de configuración

### 8. Integraciones

#### Holded
- Exportación de presupuestos y pedidos
- Sincronización de clientes
- Generación de PDFs
- Webhooks para actualizaciones

#### WooCommerce
- Sincronización de productos
- Mapeo de productos EasyQuote a WooCommerce
- CSV upload de productos

### 9. Sistema de Plantillas PDF

- Múltiples plantillas disponibles (Template1-6)
- Registro en `src/utils/templateRegistry.ts`
- Configuración por organización en `pdf_configurations`
- Renderizado con `QuoteTemplate` component

### 10. Autenticación y Permisos

- Multi-tenant: organizaciones con miembros
- Roles: superadmin, admin, user, comercial, operador
- RLS policies basadas en organization_members
- Credenciales EasyQuote por organización

## Comandos Útiles

```bash
# Ver logs de edge functions
npx supabase functions logs <function-name>

# Deploy edge functions
npx supabase functions deploy <function-name>

# Ver estructura de base de datos
psql -h <host> -U postgres -d postgres -c "\dt"
```

## Contacto con APIs Externas

- **EasyQuote API**: Gestión en `src/lib/easyquoteApi.ts`
- **Holded API**: Edge functions en `supabase/functions/holded-*`
- **WooCommerce**: Edge functions en `supabase/functions/woocommerce-*`

---

**Última actualización**: 2025-01-14
**Mantener actualizado**: Cada vez que se establezca una nueva regla crítica de negocio
