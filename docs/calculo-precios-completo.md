# Cálculo de precios — Mapa completo de elementos

> Documento de referencia OBLIGATORIO antes de tocar cualquier lógica de
> pricing, ajustes, multi‑cantidad, tarifas o aprobación de presupuestos.
> Refleja el comportamiento implementado en `QuoteItem.tsx`, `QuoteEdit.tsx`
> y `QuoteNew.tsx` (v7.2.24).

---

## 0. Glosario

| Término | Significado |
|---|---|
| **API price** | Precio que devuelve el endpoint `easyquote-pricing` para los prompts/outputs actuales. Es la única fuente de verdad del cálculo técnico. |
| **basePrice** (simple) | `outputs.Price` o `pricing.price` del API (sin tarifa, sin ajustes). |
| **baseCompositePrice** | Suma de `Price` de todos los componentes activos + `parentBasePrice` del producto compuesto padre. |
| **parentBasePrice** | Precio del producto padre del compuesto (suele ser 0, pero se suma si el padre tiene Excel propio). |
| **itemAdditionals** | Ajustes de artículo (tabla `additionals` aplicada vía `item_additionals` JSONB en `quote_items`). |
| **quoteAdditionals** | Ajustes de presupuesto a nivel global (JSONB en `quotes.quote_additionals`). |
| **multi / multiRows** | Modo "multi-cantidad": calcula precios para varias cantidades en paralelo (`Q1, Q2, Q3…`). |
| **Tarifa de cliente** | Descuento o recargo `%` definido en `tariffs` y vinculado al cliente vía `customers.tariff_id`. |
| **safePrice / parseEsNumber** | Normalizan números preservando todos los decimales (NO redondean a 2). |

---

## 1. Orden canónico del cálculo

El cálculo SIEMPRE sigue este pipeline. Romperlo causa regresiones.

```
1. prompts (entradas usuario)
        ↓ PATCH easyquote-pricing
2. outputs + price (respuesta API)  ← fuente de verdad técnica
        ↓
3. basePrice / baseCompositePrice    (suma componentes si compuesto)
        ↓
4. Tarifa de cliente  (SOLO al precio base, NUNCA a ajustes)
        ↓
5. itemAdditionals    (sumados sin tarifa, según tipo)
        ↓
6. multi-cantidad     (si activo: repite 3-5 por cada Qn)
        ↓
7. price del item     (se persiste en quote_items.price)
        ↓
8. Σ items = subtotal del presupuesto
        ↓
9. quoteAdditionals   (ajustes globales sin tarifa)
        ↓
10. final_price       (se persiste en quotes.final_price)
```

---

## 2. Tipos de ajuste (`additionals.type`)

Aplican igual a item‑level y a quote‑level.

| Tipo | Fórmula | Notas |
|---|---|---|
| `net_amount` | `+ value` (importe fijo) | En multi puede tener overrides por cantidad (`multiValues[qtyIndex]`). |
| `percentage` | `+ basePrice * value / 100` | **Se aplica SIEMPRE sobre el precio base SIN tarifa.** En multi se revierte la tarifa antes del cálculo. |
| `quantity_multiplier` | `+ value * quantity` | `quantity` = la cantidad activa (de prompt o de multiRow). |
| `capacity_divider` | `+ value * Math.ceil(quantity / capacity_value)` | Ej.: pallets/cajas. `capacity_value` por defecto 1. |

`is_discount: true` → el valor se **resta** (signo invertido).
`is_active: false` → no se aplica.

---

## 3. Tarifa de cliente — REGLA DE ORO

> La tarifa **SOLO** modifica el precio base devuelto por el API.
> NUNCA modifica ningún ajuste (ni de artículo ni de presupuesto).

### Aplicación
- Producto simple → sobre `basePrice` (output `Price`).
- Producto compuesto → sobre `baseCompositePrice` (suma de componentes + padre).
- Multi-cantidad → sobre el `totalStr` de cada multiRow (que ya viene del API).

### NO aplicación (ajustes)
- ❌ `net_amount`
- ❌ `percentage` (el % se calcula sobre el precio base SIN tarifa, revertiéndola si fuese necesario)
- ❌ `quantity_multiplier`
- ❌ `capacity_divider`
- ❌ `quoteAdditionals` (a nivel presupuesto)

### Implementación
- `QuoteItem.applyCustomerTariffToBasePrice(basePrice)` solo se llama sobre el precio base.
- En `calculateAdditionalsForQty` (multi) se revierte la tarifa del precio de fila antes de aplicar el `%`.
- `QuoteEdit.calculateSubtotal()` NO vuelve a aplicar tarifa (los items ya la incluyen).
- `QuoteNew` y `QuoteEdit` NO aplican tarifa a `quoteAdditionals`.

### Visibilidad
- La tarifa se aplica de forma silenciosa (queda dentro de `final_price`).
- Solo admins ven el badge "Tarifa cliente" en el resumen de totales.
- No se exporta a Holded ni aparece como línea en PDFs.

---

## 4. Productos compuestos

### Estructura
- Producto padre (`composite_product`) con sus propios prompts/outputs definidos en BD.
- N componentes (`composite_product_components`), cada uno con su Excel propio.
- Datos generales (cantidad, formato, encuadernación) se definen en el padre y se propagan a los componentes vía `composite_prompt_connections`.

### Cálculo
1. Un PATCH al producto padre (si tiene Excel propio) → `parentBasePrice`.
2. Un PATCH por cada componente → `componentPrice[i]`.
3. `baseCompositePrice = parentBasePrice + Σ componentPrice[i]` (solo activos).
4. Aplicar tarifa, ajustes y multi como cualquier item.

### Aislamiento de instancias
- Múltiples instancias del mismo componente (Interior 1, Interior 2…) mantienen `componentInstanceId` único → no se mezclan datos.
- Caché de pricing por `instanceId + organization_id`.

### Outputs agregados
- `composite_output_aggregations` permite sumar/promediar outputs de componentes en un único output del compuesto (ej. peso total).

---

## 5. Multi‑cantidad

### Activación
- Bandera `multiEnabled` por item.
- Genera `multiRows[]` con `{ qty, totalStr, ...outputs }` por cada cantidad.

### Cálculo por fila
Para cada `multiRow[i]` (cantidad `Qi`):
```
rowBase = totalStr (precio API para Qi, ya incluye tarifa)
rowAdditionals = Σ ajustes con la cantidad Qi:
  - net_amount: usa multiValues[i] si existe, sino value
  - percentage: (rowBase / tariffFactor) * value / 100   ← revierte tarifa
  - quantity_multiplier: value * Qi
  - capacity_divider: value * Math.ceil(Qi / capacity_value)
rowPrice = rowBase + rowAdditionals
```

### Selección
- En modo multi, el `price` del item es el de la cantidad seleccionada (`selectedMultiIndex`).
- Al guardar/aprobar, se persiste todo el array `multi.rows` para no perder información.

---

## 6. Ajustes a nivel presupuesto (`quoteAdditionals`)

Se aplican al subtotal (suma de precios de items, ya con tarifa incluida):

```
subtotal = Σ items[i].price
total = subtotal
for each adj in quoteAdditionals:
  switch adj.type:
    net_amount       → total += adj.value
    percentage       → total += subtotal * adj.value / 100
    quantity_multiplier / capacity_divider → solo tiene sentido a nivel item, se ignoran o usan cantidad 1
total = applyDiscount(total, customerTariff)?  // ❌ NO, ya está aplicada en items
final_price = total
```

⚠️ La tarifa NO se vuelve a aplicar aquí. Aplicarla sería doble descuento (regresión histórica corregida).

---

## 7. Aprobación de presupuesto → pedido

`resolveApprovedQuoteItemState`:
1. Toma la cantidad aprobada (`approvedQuantity`).
2. Sincroniza prompts/outputs con esa cantidad (si era multi).
3. Mantiene `item_additionals` íntegros, recalculando solo lo dependiente de cantidad (`quantity_multiplier`, `capacity_divider`, `multiValues[i]`).
4. El `price` aprobado debe coincidir con el mostrado en la fila seleccionada.
5. NO recalcula contra el API: usa los datos persistidos en BD (snapshot inmutable).

---

## 8. Persistencia y precisión decimal

### Reglas
- ✅ Persistir el número EXACTO devuelto por el API (todos los decimales).
- ✅ `safePrice` / `parseEsNumber` NO redondean.
- ✅ Inputs numéricos: `step="any"` (no `step="0.01"`).
- ❌ NUNCA `toFixed(2)` antes de guardar.
- ❌ NUNCA `Math.round(x * 100) / 100` antes de guardar.
- ✅ Solo se redondea para **mostrar** (`fmtEUR`), nunca para guardar.

### Campos sensibles
- `quote_items.price` — número exacto del API.
- `quote_items.item_additionals[].value` — exacto, sin truncar.
- `quote_items.multi.rows[].totalStr` — exacto.
- `quote_items.outputs[].value` — exacto (incluye `Price`, peso, dimensiones).
- `quotes.final_price` — exacto.

### Regresión conocida
- Duplicar un presupuesto antiguo que tenía valores ya redondeados arrastra esos valores. El precio del API puede haber cambiado en el motor (Excel actualizado) → divergencia esperada y NO indica bug.
- Para diagnosticar duplicados con totales distintos: comparar `prompts` y `outputs` del API entre original y copia, no asumir rounding.

---

## 9. Sincronización QuoteItem ↔ padre

- `QuoteItem` notifica al padre vía `onChange` SOLO cuando hay cambios reales (guard de igualdad por objeto).
- Evita bucles de re-render que invalidarían selecciones del usuario.
- Al guardar SIN editar, `price` debe quedar idéntico al de BD (regresión #640: pasaba de 1.845,75 € → 1.680 €).

---

## 10. Checklist OBLIGATORIO antes de cerrar cambios

Al tocar pricing/tarifas/ajustes/persistencia, validar SIEMPRE:

1. ✅ Abrir presupuesto existente, guardar sin tocar nada → total idéntico al céntimo (todos los decimales).
2. ✅ Tarifa de cliente NO se aplica a ningún ajuste (item ni presupuesto).
3. ✅ Prompts guardados NO se sobrescriben con respuesta del API al cargar.
4. ✅ Multi-cantidad: % se calcula sobre precio API SIN tarifa; overrides `multiValues` se respetan.
5. ✅ Aprobación: precio aprobado = precio mostrado en fila seleccionada; `item_additionals` íntegros.
6. ✅ Compuesto: precio = Σ componentes activos + padre; instancias múltiples aisladas.
7. ✅ Visibilidad de prompts: ocultos por selección dinámica NO se exportan ni aparecen en PDF.
8. ✅ Numeración: duplicar usa `next_document_number` RPC, aislada por `organization_id`.
9. ✅ Decimales: ningún `toFixed(2)` ni `Math.round` en el camino de guardado.

---

## 11. Diagrama resumen

```
PROMPTS (usuario)
   │
   ▼
PATCH /easyquote-pricing  ────►  outputs + price (API)
   │                                    │
   │                          ┌─────────┴──────────┐
   ▼                          │                    │
SIMPLE                     COMPUESTO            MULTI
basePrice = price          baseCompositePrice    multiRows[i].totalStr
                           = Σ components +
                             parentBasePrice
   │                          │                    │
   └────────► × tarifa cliente (SOLO base) ◄───────┘
                              │
                              ▼
                  + itemAdditionals (sin tarifa)
                              │
                              ▼
                  quote_items.price (decimales exactos)
                              │
                              ▼
                  Σ items = subtotal
                              │
                              ▼
                  + quoteAdditionals (sin tarifa)
                              │
                              ▼
                  quotes.final_price
```
