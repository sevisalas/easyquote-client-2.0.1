

# Plantilla PDF personalizada para Campillo Nevado

## Resumen

Crear una nueva plantilla PDF (Template7 - "Campillo") exclusiva para la organizacion Campillo Nevado, replicando el diseno de su hoja de factura corporativa. Incluye una segunda pagina con condiciones de venta editables desde la configuracion de la app.

## Que se hara

### 1. Nueva plantilla: Template7 (Campillo)

**Pagina 1 - Presupuesto:**
- Banda verde degradada superior con logo de Campillo Nevado hardcoded
- Texto "ARTES GRAFICAS" + logo + "CAMPILLO NEVADO S.A." + NIF
- Texto vertical izquierdo con datos del Registro Mercantil
- Zona central con datos del cliente, tabla de items (misma estructura que las demas plantillas)
- Pie de pagina con decoracion de olas verdes y datos fijos:
  - Desierto de Tabernas, 8 / 28320 PINTO (Madrid)
  - Telef. 91 560 93 34
  - contabilidad@campillonevado.es / www.campillonevado.es

**Pagina 2 - Condiciones (opcional, solo si hay texto configurado):**
- Titulo "CONDICIONES DE VENTA"
- Texto de condiciones leido desde `pdf_configurations.terms_page_text`
- Clausula LOPD al pie (tambien configurable)

### 2. Base de datos

- Agregar columna `terms_page_text` (text, nullable) a la tabla `pdf_configurations`
- Insertar registro en `pdf_templates` con `template_number: 7`, `organization_id: 108bcc37-fc60-4bc0-a81f-c30641d0ebc9` (Campillo Nevado), `is_global: false`, `is_custom: true`

### 3. Registro de plantilla

- Anadir Template7 al mapa `templateComponents` en `src/utils/templateRegistry.ts`
- La plantilla solo aparecera para Campillo porque `pdf_templates` la filtra por `organization_id`

### 4. Configuracion de condiciones en la UI

- En `SettingsPdfTemplate.tsx`, anadir un campo de texto largo (textarea) para `terms_page_text` que solo se muestre cuando la plantilla seleccionada lo soporte (template 7)
- El campo se guarda y carga junto con el resto de la configuracion

### 5. Generador de PDF

- Modificar `pdfGenerator.ts` para que al renderizar Template7, tambien renderice la segunda pagina de condiciones y la anada como pagina adicional al PDF

### 6. Imagen de logo

- Copiar el logo de Campillo al proyecto (o usar la URL del logo ya subido) para incrustarlo directamente en la plantilla

## Secuencia tecnica

```text
1. Migracion SQL
   +-- Agregar columna terms_page_text a pdf_configurations
   +-- Insertar pdf_templates para template 7 (Campillo)

2. Crear src/components/templates/Template7.tsx
   +-- Pagina 1: cabecera verde, datos fijos Campillo, items, pie verde
   +-- Pagina 2: condiciones de venta (desde data.config.termsPageText)

3. Actualizar src/utils/templateRegistry.ts
   +-- Importar Template7
   +-- Agregar al mapa templateComponents[7]

4. Actualizar src/utils/pdfGenerator.ts
   +-- Cargar terms_page_text desde pdf_configurations
   +-- Pasarlo como config.termsPageText al templateData
   +-- Manejar renderizado multi-pagina para la pagina de condiciones

5. Actualizar src/pages/SettingsPdfTemplate.tsx
   +-- Agregar textarea para terms_page_text
   +-- Mostrar solo cuando selectedTemplate == 7

6. Actualizar src/hooks/usePdfConfiguration.ts
   +-- Agregar terms_page_text al tipo PdfConfiguration
```

## Restricciones

- La plantilla 7 solo sera visible para Campillo Nevado (filtrada por organization_id en pdf_templates)
- Anebri y otras organizaciones no la veran en su selector
- Los datos de empresa (direccion, telefono, etc.) van hardcoded en el componente, no desde la configuracion
- El logo tambien va fijo en la plantilla

