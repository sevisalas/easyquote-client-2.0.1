
# Adjuntar documentos externos a presupuestos y pedidos para Holded

## Objetivo
Permitir que los usuarios adjunten archivos (PDF, imágenes, etc.) a presupuestos y pedidos mientras los crean o editan. Cuando el documento se envie a Holded, los archivos adjuntos se envian automaticamente al documento creado en Holded usando su API de attach.

## Flujo de usuario
1. En la pantalla de crear/editar presupuesto o pedido, el usuario ve una seccion "Documentos adjuntos"
2. Puede subir uno o varios archivos (drag & drop o selector)
3. Los archivos se almacenan en Supabase Storage
4. Al enviar a Holded (presupuesto con "Enviar a Holded" o pedido al aprobar), los archivos se envian al documento Holded via `POST /documents/{docType}/{documentId}/attach`

## Cambios necesarios

### 1. Base de datos

**Nuevo bucket de storage:** `document-attachments` (privado)

**Nueva tabla:** `document_attachments`
- `id` (uuid, PK)
- `organization_id` (uuid, FK organizations, NOT NULL)
- `quote_id` (uuid, FK quotes, nullable)
- `sales_order_id` (uuid, FK sales_orders, nullable)
- `file_name` (text, NOT NULL)
- `file_path` (text, NOT NULL) -- ruta en storage
- `file_size` (integer)
- `mime_type` (text)
- `created_by` (uuid)
- `created_at` (timestamptz, default now())

Con RLS: miembros de la organizacion pueden CRUD sus propios adjuntos.

### 2. Componente UI: `DocumentAttachments`

Nuevo componente reutilizable (`src/components/quotes/DocumentAttachments.tsx`):
- Acepta props: `quoteId?`, `salesOrderId?`, `organizationId`, `readOnly?`
- Muestra lista de archivos adjuntos con nombre, tamano y boton eliminar
- Boton "Adjuntar archivo" que usa `react-dropzone` (ya instalado)
- Sube archivos a bucket `document-attachments` con ruta `{orgId}/{quoteId|orderId}/{filename}`
- Inserta registro en `document_attachments`
- Modo solo lectura para vistas de detalle

### 3. Integracion en paginas

Anadir el componente `DocumentAttachments` en:
- `QuoteNew.tsx` -- despues de guardar el presupuesto (se habilita tras primer guardado, o se almacenan temporalmente)
- `QuoteEdit.tsx` -- en la seccion de detalles, debajo de notas
- `SalesOrderNew.tsx` -- similar a quotes
- `SalesOrderEdit.tsx` -- similar a quotes
- `QuoteDetail.tsx` y `SalesOrderDetail.tsx` -- en modo solo lectura

### 4. Edge function: `holded-attach-document`

Nueva edge function que:
1. Recibe `documentId` (Holded), `docType` ("estimate" o "salesorder"), y `attachmentIds` (array de IDs de `document_attachments`)
2. Obtiene la API key de Holded de la organizacion (mismo patron que export-estimate/export-order)
3. Para cada archivo:
   - Descarga el archivo de Supabase Storage usando service_role
   - Envia a Holded via `POST /documents/{docType}/{documentId}/attach` como `multipart/form-data`
4. Devuelve resultado de cada attach

### 5. Modificacion de edge functions existentes

**`holded-export-estimate/index.ts`:**
- Despues de crear el documento en Holded y obtener `holdedData.id`, consultar `document_attachments` donde `quote_id` = quoteId
- Si hay adjuntos, invocar `holded-attach-document` pasando el `holdedData.id`, docType `"estimate"`, y los attachment IDs

**`holded-export-order/index.ts`:**
- Mismo patron: despues de crear el salesorder en Holded, consultar adjuntos del pedido
- Si hay adjuntos, invocar `holded-attach-document`

### 6. Detalles tecnicos

**API de Holded para attach:**
```
POST https://api.holded.com/api/invoicing/v1/documents/{docType}/{documentId}/attach
Headers: key: {apiKey}, content-type: multipart/form-data
Body: FormData con el archivo
```

Donde `docType` es `estimate` para presupuestos y `salesorder` para pedidos.

**Storage path pattern:** `{organization_id}/{document_type}/{document_id}/{timestamp}_{filename}`

**Limites sugeridos:** Maximo 5 archivos por documento, maximo 10MB por archivo.

### 7. Migracion SQL resumida

```sql
-- Bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('document-attachments', 'document-attachments', false);

-- Tabla
CREATE TABLE document_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  sales_order_id uuid REFERENCES sales_orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_one_parent CHECK (
    (quote_id IS NOT NULL AND sales_order_id IS NULL) OR
    (quote_id IS NULL AND sales_order_id IS NOT NULL)
  )
);

-- RLS
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
-- Politicas para miembros de la organizacion
```

**Storage RLS:** Politicas para que miembros de la organizacion puedan subir/leer/eliminar archivos en su carpeta de organizacion.

### 8. Propagacion quote -> order

Cuando se aprueba un presupuesto (`useQuoteApproval`), los adjuntos del presupuesto se copian al pedido resultante (se duplican los registros en `document_attachments` apuntando al `sales_order_id`, reutilizando el mismo `file_path` en storage).
