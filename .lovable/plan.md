# Plan · Presupuestos Agrupados v1

Implementación según el documento interno `Presupuestos-Agrupados-Especificacion.docx`. Sin multi-cantidad: se copia siempre la cantidad principal/aprobada.

## 1. Migración SQL (una sola)

```sql
ALTER TABLE quotes ADD COLUMN grouped_at timestamptz NULL;

ALTER TABLE quote_items
  ADD COLUMN grouped_into_quote_id uuid NULL,
  ADD COLUMN source_quote_id uuid NULL,
  ADD COLUMN source_item_id uuid NULL;

CREATE INDEX idx_quote_items_grouped_into ON quote_items(grouped_into_quote_id);
CREATE INDEX idx_quote_items_source_quote ON quote_items(source_quote_id);
CREATE INDEX idx_quote_items_source_item  ON quote_items(source_item_id);
```

Nota: `status` en `quotes` es `text` libre (no enum), así que no requiere ALTER. Se usará el literal `'grouped'`.

## 2. Edge Function `create-grouped-quote`

Nueva función en `supabase/functions/create-grouped-quote/index.ts`:

- Valida JWT, pertenencia del caller a `organization_id` (vía `organization_members`).
- Valida que todos los `source_item_id` existen, están en la misma org y tienen `grouped_into_quote_id IS NULL`.
- Llama RPC `next_document_number(org, 'quote')`.
- Inserta nueva `quotes` con `status='draft'`, `customer_id` recibido, `final_price = SUM(items.price)`.
- Deep copy de cada item (prompts, outputs, composite_data, item_additionals, description, price, quantity → cantidad principal/aprobada usando misma lógica que export Holded vía `approvedMultiQuantity`), guardando `source_quote_id` y `source_item_id`.
- Update de cada item origen: `grouped_into_quote_id = nuevo_quote_id`.
- Por cada presupuesto origen distinto: `status='grouped'`, `grouped_at=now()`, invalidar tokens de portal (`quote_portal_tokens`).
- Todo en una operación; ante fallo se hace rollback manual (borrar quote nuevo).
- Devuelve `{ quote_id, quote_number }`.

## 3. Bloqueo de transiciones

Centralizar helper `isQuoteLocked(status) => status === 'grouped'`:

- `QuoteDetail.tsx` y `QuoteEdit.tsx`: banner magenta apagado “Este presupuesto fue agrupado en {número} el {fecha}. No puede aprobarse.”, botones Aprobar/Enviar/Editar deshabilitados con tooltip.
- `useQuoteApproval.ts`: rechazar si origen está `grouped`.
- `portal-quote` edge function y `PortalQuote.tsx`: 404 si `status='grouped'`.

## 4. UI

### 4.1 Lista de presupuestos
- `QuotesList.tsx`: añadir `'grouped'` a `statusOptions` con label “Agrupado”. Botón secundario “Nuevo presupuesto agrupado” → `/presupuestos/agrupado/nuevo`.
- `QuoteCard.tsx`: variante de badge para `'grouped'` (magenta apagado).

### 4.2 Pantalla `/presupuestos/agrupado/nuevo`
Nuevo `src/pages/GroupedQuoteNew.tsx` + ruta en `App.tsx`. Layout 2 columnas (stack en móvil):

- **Izquierda · Origen**: buscador por número/cliente, presupuestos desplegables con checkbox por item. Items ya agrupados deshabilitados con badge “Ya agrupado en {número}”. Items multi-cantidad con badge informativo “Multi-cantidad: se copiará la cantidad principal”.
- **Derecha · Agrupado**: selector de cliente (precarga del primer presupuesto añadido, editable), lista en tiempo real de items seleccionados con su origen, total acumulado, botones “Cancelar” / “Crear agrupado”.
- Al confirmar: invoke `create-grouped-quote` → navegar a `/presupuestos/{nuevo_id}`.

### 4.3 Trazabilidad visual (solo UI, nunca documentos)
- Items origen: badge “Agregado al presupuesto {número}” → click navega al destino.
- Items destino: badge “Procedente de {número} · item #N” → click navega al origen.

## 5. Documentos / exportaciones

- `pdfGenerator.ts`, `workOrderPdfGenerator.tsx`, `format-quote-for-pdf`: ignorar `grouped_into_quote_id`, `source_quote_id`, `source_item_id`. No renderizar badges.
- `holded-export-estimate` / `holded-export-order`: verificar que los nuevos campos no se mapean (no requieren cambio si no se referencian explícitamente).
- `portal-quote`: bloquear `status='grouped'`.

## 6. RBAC

- Crear agrupado: Admin, Gestor, Comercial. Comerciales solo ven sus propios presupuestos como origen (RLS existente sirve).
- Cambio a/desde `'grouped'`: solo vía edge function. UI no expone toggle.

## 7. Memoria

- Crear `mem://features/quotes/grouped-quotes` (estado grouped bloquea aprobación, trazabilidad invisible en docs, v1 sin multi-cantidad, ruta UI).
- Referenciar en `mem://index.md`.

## 8. Ficheros tocados

| Fichero | Cambio |
|---|---|
| Migración SQL | ALTER quotes + quote_items + 3 índices |
| `supabase/functions/create-grouped-quote/index.ts` | Nueva |
| `src/pages/GroupedQuoteNew.tsx` | Nueva |
| `src/App.tsx` | Ruta `/presupuestos/agrupado/nuevo` |
| `src/pages/QuotesList.tsx` | Botón + estado “Agrupado” en filtro |
| `src/components/quotes/QuoteCard.tsx` | Badge variante `grouped` |
| `src/pages/QuoteDetail.tsx`, `src/pages/QuoteEdit.tsx` | Banner, bloqueos, badges items |
| `src/hooks/useQuoteApproval.ts` | Bloqueo transiciones |
| `src/utils/pdfGenerator.ts`, `workOrderPdfGenerator.tsx`, `format-quote-for-pdf` | Excluir campos nuevos |
| `supabase/functions/portal-quote/index.ts` + `src/pages/PortalQuote.tsx` | 404 si grouped |
| `mem://features/quotes/grouped-quotes` + `mem://index.md` | Documentar |

## 9. Decisiones cerradas

- Multi-cantidad **NO** soportado en v1: se copia solo la cantidad principal/aprobada con aviso visible.
- Cliente del agrupado lo elige el usuario (precarga del primero añadido).
- Items origen permanecen físicamente; solo se marcan con `grouped_into_quote_id`.
- Tokens de portal del origen se invalidan al pasar a `grouped`.
