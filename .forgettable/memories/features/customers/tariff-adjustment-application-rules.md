# Memory: features/customers/tariff-adjustment-application-rules
Updated: 2026-04-08

## Regla de aplicación de tarifa a ajustes (additionals)

La tarifa del cliente se aplica a **todos** los ajustes excepto los porcentuales:

- **net_amount** → SÍ se aplica tarifa (al valor fijo)
- **quantity_multiplier** → SÍ se aplica tarifa (al valor unitario antes de multiplicar)
- **capacity_divider** → SÍ se aplica tarifa (al valor unitario antes de multiplicar)
- **percentage** → NO se aplica tarifa (ya actúa sobre el precio base que ya tiene la tarifa aplicada)

Esto aplica tanto a:
- Ajustes de artículo (`itemAdditionals` en QuoteItem.tsx)
- Ajustes de presupuesto (`quoteAdditionals` en QuoteNew.tsx)

### Razón
El porcentaje ya se calcula sobre el precio base con tarifa aplicada, por lo que aplicar la tarifa de nuevo sería un doble descuento/recargo.
