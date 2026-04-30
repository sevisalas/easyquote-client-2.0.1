## Objetivo
Corregir las plantillas PDF 7 y 8 para que las cantidades múltiples (Q2, Q3, etc.) muestren exactamente el importe almacenado, sin recalcular nada en el PDF.

## Qué voy a cambiar
1. En `src/components/templates/Template7.tsx`, eliminar la suma manual de ajustes en las filas Q2/Q3 y mostrar directamente `me.price`.
2. En `src/components/templates/Template8.tsx`, hacer exactamente lo mismo: usar solo `me.price` en cada fila multi-cantidad.
3. Mantener `src/utils/pdfGenerator.ts` como fuente de entrada de esos importes multi, ya que ya está leyendo `item.multi.rows[i].totalStr` y lo pasa a `multi_extra.price`.
4. No tocar la lógica de cálculo del presupuesto en pantalla: el arreglo es solo para que el PDF deje de recalcular y consuma el valor guardado.

## Resultado esperado
- Q1 seguirá usando `item.price` guardado.
- Q2/Q3 pasarán a usar el valor guardado en `multi.rows[].totalStr`.
- Pantalla y PDF saldrán con el mismo importe para cada cantidad.
- Se elimina la inconsistencia por doble cálculo.

## Verificación
- Probaré el presupuesto 732.
- Compararé Q1, Q2 y Q3 entre pantalla y PDF.
- Confirmaré que T7 y T8 ya no añaden `item_additionals` por segunda vez en las filas multi.

## Detalle técnico
Hoy el bug está en ambas plantillas:
- leen `me.price` como base almacenada
- pero luego vuelven a sumar `adjTotal`
- eso duplica/reconstruye ajustes y rompe descuentos/overrides

La corrección será dejar esta regla única:
- PDF multi-cantidad = valor almacenado
- cero cálculos adicionales en render