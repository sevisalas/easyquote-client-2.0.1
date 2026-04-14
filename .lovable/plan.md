

## Plan: Reactivar descuentos/tarifas de cliente

### Contexto
El hook `useActiveCustomerDiscounts` fue desactivado — siempre devuelve una lista vacía y la query esta deshabilitada. Los datos en la base de datos estan intactos (tarifas, asignaciones a clientes).

### Cambio necesario

**Archivo**: `src/hooks/useCustomerDiscounts.ts`

Reactivar la funcion `useActiveCustomerDiscounts` para que:

1. Busque el cliente por `normalizedCustomerId` en la tabla `customers` para obtener su `tariff_id`
2. Si tiene `tariff_id`, busque la tarifa en la tabla `tariffs`
3. Si la tarifa existe y esta activa (`is_active = true`), la devuelva como un `CustomerDiscount` (mapeando los campos)
4. Si no tiene tarifa asignada, devuelva array vacio

La query se habilitara (`enabled: true`) cuando haya `customerId` y `organizationId`.

### Sin otros cambios
No se toca ningún otro archivo. QuoteNew, QuoteEdit y SalesOrderNew ya consumen este hook correctamente — solo necesitan que vuelva a devolver datos reales.

