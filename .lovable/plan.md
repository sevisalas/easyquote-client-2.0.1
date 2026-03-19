

## Mejora visual de los campos de entrada (prompts)

### Problema actual
Cada prompt se muestra como una tarjeta plana con dos filas densas:
1. Una fila de 12 columnas con campos API (Hoja, Rótulo, Valor, Orden, Rango, Tipo, acciones)
2. Una fila de switches en línea (Requerido, Ocultar docs, Solo admin, Opc. restrictiva, Oculto, Cantidad, OT, Sección OT) + Etiqueta + Variable de producción

Esto resulta abrumador, especialmente con muchos prompts.

### Solución propuesta: tarjeta colapsable con secciones agrupadas

Cada prompt se convierte en un **Collapsible** que por defecto muestra solo una línea resumen, y al expandir muestra los detalles organizados en secciones claras.

#### Vista colapsada (una línea por prompt)
```text
┌──────────────────────────────────────────────────────────────────┐
│ ▶  #1  ·  "Ancho" (C5→C6)  ·  DropDown  ·  Hoja: Datos  ·  🔒 │
└──────────────────────────────────────────────────────────────────┘
```
- Número de orden, etiqueta o promptText, celdas, tipo, hoja
- Iconos pequeños para indicar flags activos (requerido, oculto, admin, OT)

#### Vista expandida (al hacer clic)
Tres secciones con títulos discretos:

**1. Configuración Excel** — los campos técnicos actuales
```text
Hoja | Rótulo | Valor | Orden | Rango (si aplica) | Tipo
```

**2. Visibilidad y comportamiento** — los switches agrupados en grid 2-3 columnas
```text
[x] Requerido        [x] Ocultar en docs    [ ] Solo admin
[ ] Opc. restrictiva [ ] Oculto              [ ] Cantidad
[ ] Mostrar en OT    [Sección OT: ___]
```
Usaremos **Checkbox** en lugar de Switch para ocupar menos espacio horizontal.

**3. Etiquetas y mapeos** — Etiqueta personalizada + Variable de producción + Componente (si compuesto)

**Acciones** (Guardar/Eliminar) se ubican en la cabecera colapsada, siempre visibles.

### Cambios técnicos

**Archivo: `src/pages/ProductConfigPage.tsx`**
- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- Reemplazar el bloque de renderizado de cada prompt (líneas ~1129-1312) con el nuevo layout colapsable
- Agrupar los switches en un grid de 3 columnas usando Checkbox en vez de Switch
- La línea resumen colapsada muestra: orden, etiqueta, celdas, tipo, badges de flags activos
- Estado local `expandedPrompts: Set<string>` para controlar qué prompts están abiertos
- Botón "Expandir todos / Colapsar todos" junto a los botones de añadir

No se modifica ninguna lógica de datos ni mutaciones, solo la presentación visual.

