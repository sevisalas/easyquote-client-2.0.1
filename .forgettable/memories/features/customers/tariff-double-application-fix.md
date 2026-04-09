# Memory: features/customers/tariff-double-application-fix
Updated: 2026-04-09

## Regla: La tarifa del cliente NO se aplica en QuoteEdit.calculateSubtotal()

### Problema resuelto
La tarifa del cliente se aplicaba DOS veces:
1. En `QuoteItem.tsx` via `applyCustomerTariffToBasePrice()` — al precio base y ajustes del artículo
2. En `QuoteEdit.tsx` via `calculateDiscountAdjustment()` — sobre la suma de precios de items

### Corrección
`QuoteEdit.calculateSubtotal()` solo suma los precios de los items tal cual, sin aplicar tarifa adicional, porque los items ya tienen la tarifa incorporada desde `QuoteItem`.

### Consistencia
- `QuoteNew.tsx` ya estaba correcto — no aplicaba tarifa al subtotal de items, solo a `quoteAdditionals` de tipo net_amount.
- `QuoteEdit.tsx` fue corregido para igualar este comportamiento.
