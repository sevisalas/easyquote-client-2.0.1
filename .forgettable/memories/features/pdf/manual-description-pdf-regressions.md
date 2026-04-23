# Regla: regresiones de descripciones manuales en PDF

## Problemas que no deben repetirse

1. **La descripción manual es la fuente de verdad en PDF**
   - Si `description_manual = true`, el PDF debe renderizar `item.description` completa.
   - Nunca sustituirla por prompts técnicos como `custom_quantity` o `custom_unit_price`.

2. **No asumir que falta espacio cuando realmente falta contenido**
   - Antes de compactar plantillas 7/8, comprobar siempre:
     - descripción guardada en base de datos
     - descripción transformada en `pdfGenerator`
     - texto final visible en el PDF
   - Si falta texto completo, revisar primero sanitización/transformación y no el layout.

3. **`sanitizeDescriptionForDocs` debe preservar líneas que terminan en `:`**
   - Ejemplo crítico: `RELACION DE LOS 4 MODELOS DE AGENDAS:`
   - Si tras los dos puntos no hay valor en la misma línea, esa línea sigue siendo válida y no debe eliminarse.

4. **Las plantillas 7 y 8 deben mantener espaciado normal por defecto**
   - No comprimir agresivamente tipografías, paddings o pies salvo que se haya demostrado que el problema real es de altura disponible.

## Protocolo de diagnóstico

Cuando un usuario diga que “falta texto” en un PDF:
1. Consultar el texto real guardado en BD.
2. Compararlo con el PDF exportado.
3. Revisar sanitización y mapeo de items.
4. Solo después tocar plantilla o paginación.