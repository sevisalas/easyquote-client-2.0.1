# Memory: features/customers/tariff-adjustment-application-rules
Updated: 2026-04-17

## Regla actual: La tarifa de cliente SOLO se aplica al precio base del API

La tarifa del cliente (`customer_discounts` / `tariffs`) se aplica **únicamente** al `price` que devuelve el motor de cálculo (EasyQuote API):
- Producto simple: al output `Price` (o `pricing.price` como fallback)
- Producto compuesto: a la suma de `Price` de los componentes (`baseCompositePrice`)

**NO se aplica a ningún ajuste**, de ningún tipo, ni de artículo ni de presupuesto:
- ❌ `net_amount` (importe fijo)
- ❌ `percentage` (se calcula sobre el precio base SIN tarifa)
- ❌ `quantity_multiplier`
- ❌ `capacity_divider`

### Implementación
- `QuoteItem.tsx`: `applyCustomerTariffToBasePrice` solo se usa sobre `basePrice`/`baseCompositePrice` y para visualización del precio. Los ajustes se suman tal cual (`additional.value`).
- Para ajustes `percentage` en multi-cantidades (`calculateAdditionalsForQty`), se revierte la tarifa del precio de fila para que el % se aplique sobre el precio API original.
- `QuoteNew.tsx`: ajustes de presupuesto (`quoteAdditionals`) NO llevan tarifa. El subtotal de items ya incluye la tarifa del item.
- `QuoteEdit.tsx`: igual, sin tarifa adicional.

### Workaround para clientes que necesitan descuento sobre ajustes
Documentado en la ayuda: introducir el ajuste con el precio ya descontado, o crear un ajuste específico de descuento por cliente.
