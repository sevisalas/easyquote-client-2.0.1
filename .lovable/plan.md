

# Plan: Redisenar la Orden de Trabajo (OT) siguiendo la muestra del cliente

## Resumen

Reescribir completamente `workOrderPdfGenerator.tsx` para que el PDF generado replique el layout de la muestra: cabecera con cliente a la izquierda y numero de OT grande a la derecha, secciones separadas por lineas rojas gruesas, datos en columnas multiples, diagramas de imposicion, y bloques de ajustes/observaciones al final.

## Layout objetivo (basado en la muestra)

```text
┌──────────────────────────────────────────────────┐
│ CLIENTE                          ORDEN DE TRABAJO│
│ NOMBRE: xxx                      OT-26-000034-B │
│ EMAIL: xxx                                       │
│ TELÉFONO: xxx                                    │
├══════════════════ linea roja ═════════════════════┤
│ ARTICULO: Nombre del producto (titulo rojo)      │
│                                                  │
│ PAPEL INTERIOR: valor                            │
│ TAMAÑO DE PAPEL: xx   PLIEGOS: xx   RS: xx      │
│ NUM PAGINAS: xx        TAM CERRADO: xx  MOD: xx  │
│                                                  │
│ PAPEL CUBIERTA: valor (si compuesto)             │
│ TAMAÑO DE PAPEL: xx   PLIEGOS: xx   RS: xx      │
├══════════════════ linea roja ═════════════════════┤
│ IMPRESION: valor                                 │
│ NUM PLIEGOS: xx                                  │
│ TINTAS: xx   PANTONE: xx   PLASTIFICADO: xx      │
├══════════════════ linea roja ═════════════════════┤
│ ACABADO: valor                                   │
│ NUM PAGINAS: xx   NUM PLIEGOS: xx                │
│ ENCUADERNACION: xx                               │
├══════════════════ linea roja ═════════════════════┤
│ ┌─────────────┐      ┌─────────────┐            │
│ │  INTERIOR    │      │  CUBIERTA   │            │
│ │ (imposicion) │      │ (imposicion)│            │
│ └─────────────┘      └─────────────┘            │
├──────────────────────────────────────────────────┤
│ AJUSTES PERSONALIZADOS: texto de ajustes         │
├──────────────────────────────────────────────────┤
│ OBSERVACIONES: espacio en blanco para notas      │
└──────────────────────────────────────────────────┘
```

## Cambios tecnicos

### Archivo: `src/utils/workOrderPdfGenerator.tsx` (reescritura completa)

1. **Cabecera** - Two-column: izquierda con CLIENTE (nombre, email, telefono), derecha con "ORDEN DE TRABAJO" y numero de OT en fuente grande (~18px). Separador rojo grueso debajo.

2. **Seccion ARTICULO** - Titulo del producto en rojo. Los prompts se renderizan en grid de 3 columnas (label:value) agrupados de forma compacta, similar al ejemplo. Para productos compuestos, se separan los prompts por componente (PAPEL INTERIOR / PAPEL CUBIERTA).

3. **Seccion IMPRESION** - Separador rojo, titulo "IMPRESION" en negrita grande, y los prompts/outputs relevantes a impresion en layout multi-columna.

4. **Seccion ACABADO** - Separador rojo, titulo "ACABADO", datos de encuadernacion y acabados.

5. **Diagramas de imposicion** - Dos cajas lado a lado (INTERIOR / CUBIERTA) usando Views de react-pdf como ya existe, pero con el layout de la muestra.

6. **Ajustes personalizados** - Seccion con los ajustes del item (si existen en item data).

7. **Observaciones** - Bloque vacio para notas manuales.

8. **Estilos** - Color rojo (#CC0000) para separadores y titulos de seccion. Fuentes mas grandes que el actual (+2px general). Un item por pagina para dar espacio.

### Nota importante sobre los datos

Los prompts y outputs actuales son genericos (vienen de la API de EasyQuote con labels configurables). No podemos hardcodear secciones como "IMPRESION" o "ACABADO" porque cada producto tiene prompts distintos. La solucion inicial sera:
- Renderizar TODOS los prompts en la seccion principal del articulo en grid de 3 columnas
- Renderizar TODOS los outputs en una seccion "DATOS TECNICOS"
- Las secciones fijas seran: Cabecera, Articulo (prompts+outputs), Imposicion, Ajustes, Observaciones
- En futuras iteraciones se pueden mapear prompts a secciones especificas

### Archivo: `src/components/production/WorkOrderItem.tsx`

Sin cambios por ahora. Este componente es la vista en pantalla, no el PDF.

