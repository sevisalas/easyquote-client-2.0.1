# Plantilla 9 - Campillo Limpia (sin fondo)

Nueva plantilla PDF exclusiva para **Campillo Nevado** (no aplicable a Anebri ni Campillo Formación), inspirada visualmente en el PDF que actualmente exporta Holded. Mantiene toda la lógica de cálculo, paginación e items de la Template 7, pero elimina el PNG de fondo y rediseña la cabecera/footer/totales según el modelo aportado.

## Diseño basado en el PDF de referencia

```text
┌────────────────────────────────────────────────────────────────┐
│ [LOGO CAMPILLO]                              PRESUPUESTO       │
│                                              Nº E260474        │
│                                                                │
│ Fecha: 30/04/2026          ESPACIO DELICIAS, S.L.              │
│ Fecha vencimiento: …       B05384441                           │
│ Ref:                       C/ LAS MERCEDES, 25                 │
│                            GETXO (48930), VIZCAYA, España      │
│                                                                │
│ ──────────────────────────────────────────────────────────────│
│  CONCEPTO                          UNIDADES  SUBTOTAL    IVA   │  ← header gris claro
│ ──────────────────────────────────────────────────────────────│
│  145,75 m2 PAÑOS DE 200x700…           1     3.194,00€   21%   │
│ ──────────────────────────────────────────────────────────────│
│  MONTAJE DEL VINILO REMOVIBLE…         1     4.065,00€   21%   │
│ ──────────────────────────────────────────────────────────────│
│  …                                                             │
│ ══════════════════════════════════════════════════════════════│
│      BASE IMPONIBLE   IMPUESTO    TOTAL IMPUESTO    TOTAL      │
│       15.222,00€      IVA 21%       3.196,62€    18.418,62€    │
│ ──────────────────────────────────────────────────────────────│
│       15.222,00€                                 18.418,62€    │
│                                                                │
│ FORMA DE PAGO POR TRANSFERENCIA BANCARIA                       │
│ ES83 0049 4088 2524 1402 8490                                  │
│                                                                │
│                                                                │
│ ──────────────────────────────────────────────────────────────│
│       Inscrita en el Reg. Merc. … (texto legal centrado)       │
│       CAMPILLO NEVADO S.A. A78094166 c/ Desierto de tabernas,8│
│       Pinto (28320), Madrid … contabilidad@campillonevado.es   │
│                                                          1/2   │
└────────────────────────────────────────────────────────────────┘
```

Página 2 (si `terms_page_text` o el footer legal de la organización tiene contenido extenso): **Términos y condiciones** a página completa, mismo footer corporativo centrado.

## Cambios clave respecto a Template 7

- **Sin fondo PNG**: se elimina por completo el `<img src="campillo-page1-bg.png">`. Fondo blanco limpio.
- **Cabecera**: logo a la izquierda, título "PRESUPUESTO" gris oscuro grande a la derecha + número debajo (gris claro). Sin recuadro verde.
- **Bloque cliente**: sin recuadro de fondo, dos columnas planas tipo Holded (fechas a la izquierda, datos del cliente a la derecha en negrita).
- **Tabla**: cabecera gris claro `#f3f3f3` con texto oscuro (no verde). Filas separadas por línea fina `#e5e5e5`. Columnas: CONCEPTO / UNIDADES / SUBTOTAL / IVA (se añade columna IVA al 21% por línea).
- **Totales**: bloque centrado de 4 columnas (BASE IMPONIBLE · IMPUESTO · TOTAL IMPUESTO · TOTAL), no la pila lateral derecha actual.
- **Footer**: centrado, multilínea con datos registrales + dirección + teléfono + email. Paginación `1/2` a la derecha.
- **Forma de pago**: bloque de texto plano debajo del total (configurable vía `footerText` o un campo nuevo de la organización; por ahora se reutiliza `data.config.footerText`).

## Lógica heredada de T7 (sin cambios)

- Paginación con `paginateTemplate7Items` (mismo helper, reservando footer share).
- Render de prompts, components, item_additionals, multi-quantity, quote_additionals globales.
- Lógica de `hideItemAmounts` para productos custom sin precio.
- Watermark BORRADOR si `quote.status === 'draft'`.
- Sanitización de descripción y prioridad manual (memoria existente).

## Implementación técnica

1. **Crear `src/components/templates/Template9.tsx`**
   - Copia de `Template7.tsx` como base.
   - Eliminar el `<img>` de fondo (líneas 58-72) y el bloque "Datos Campillo abajo derecha" (líneas 405-424).
   - Reescribir cabecera, bloque cliente, header de tabla, totales y footer según diseño.
   - Mantener exactamente el mismo `paginateTemplate7Items` y bucle de items.
   - Marcar páginas con `data-template9-page data-terms-page` para que el generador PDF las pagine igual.

2. **Registrar en `src/utils/templateRegistry.ts`**
   - Importar `Template9`.
   - Añadir `9: Template9` al map `templateComponents`.

3. **Insertar registro en BD `pdf_templates`** (migración SQL)
   - `template_number=9`, `name='Campillo Limpia'`, `is_global=false`, `is_active=true`, `organization_id='108bcc37-fc60-4bc0-a81f-c30641d0ebc9'` (Campillo Nevado únicamente — NO Anebri, NO Campillo Formación).
   - `description='Diseño limpio sin fondo, estilo factura Holded'`.
   - `thumbnail_url`: por ahora reutilizar `/assets/template7-preview.png` o generar uno nuevo después.

4. **Sin tocar** `Template7.tsx`, `Template8.tsx`, ni la lógica de exportación a Holded, OT, ni `workOrderPdfGenerator`.

## QA

- Verificar render en `/configuracion/plantilla-pdf` con la organización Campillo Nevado seleccionada (solo ahí debe aparecer la opción "Campillo Limpia").
- Confirmar que Anebri y Campillo Formación NO ven la plantilla 9.
- Generar PDF real desde un presupuesto de Campillo y comprobar fondo blanco, totales centrados, footer corporativo y paginación correcta.

## Changelog

Añadir entrada **2.7.28** en `Novedades.tsx`: "Nueva plantilla PDF 'Campillo Limpia' (#9) exclusiva para Campillo Nevado, basada en la lógica de la plantilla 7 pero con fondo blanco y diseño tipo factura."
