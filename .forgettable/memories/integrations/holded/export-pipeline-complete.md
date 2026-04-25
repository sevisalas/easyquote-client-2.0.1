# Memory: integrations/holded/export-pipeline-complete
Updated: 2026-04-25

## Referencia obligatoria antes de tocar cualquier código de Holded

Documento detallado: `docs/integracion-holded-completa.md`.
Pipeline de precios: `docs/calculo-precios-completo.md`.

## Reglas invariantes

1. **API key por tenant**: `organization_integration_access.access_token_encrypted`
   + `decrypt_credential`. Nunca usar `HOLDED_API_KEY` env como fallback en
   exportaciones (solo `holded-sync-order-number` lo hace por compatibilidad).
2. **Precios ya calculados**: las edge functions NO recalculan tarifa ni
   ajustes; leen `outputs[type=Price]` / `row.outs[type=Price]` /
   `item.price`. Si el precio en Holded sale mal, el bug está aguas arriba
   (QuoteItem/QuoteEdit), NO en la edge function.
3. **Outputs nunca se envían**. Solo prompts visibles.
4. **Decimales a 6**, jamás a 2 (`Math.round(x * 1_000_000) / 1_000_000`).
5. **Status protection**: estimate POST nunca pasa `approved` → `sent`.

## Modos de exportación (`configuration.export_mode`)

| Modo | sent → estimate | approved → estimate | approved → order |
|---|---|---|---|
| `all` (default) | ✅ | ❌ | ✅ |
| `estimates_on_approval` | ❌ | ✅ | ✅ |
| `orders_only` | ❌ | ❌ | ✅ |

Frontend decide vía `useHoldedIntegration`:
`canExportQuotesOnSend`, `canExportQuotesOnApproval`, `canExportQuotes`,
`canExportOrders`. Edge functions NO leen `export_mode`.

## Peculiaridades por tenant

- **T7 Campillo / T8 Anebri** (`pdf_configurations.selected_template`):
  `hideItemAdjustmentsInHolded = true` → ajustes de ITEM no aparecen como
  texto en la descripción Holded (sí van integrados en el precio).
- **`organizations.hide_all_prompts_in_documents`**: usa
  `quote_items.description` directo en vez de armar desde prompts.
- **Campillo Formación**: integración Holded inactiva (excluido).
- **`organization_members.cuenta_holded`** del CREADOR del documento →
  `salesChannelId`. Catálogo en `holded_sales_accounts`.

## Ajustes (item_additionals vs quote_additionals)

- Ajustes de ITEM: SIEMPRE integrados en el precio del item (suma a
  `subtotal`, descuentos a `itemData.discount`). Tipos: `net_amount`,
  `percentage`, `quantity_multiplier`, `capacity_divider`. Nunca como
  línea separada.
- Ajustes de PRESUPUESTO/PEDIDO: SIEMPRE como línea independiente con
  nombre limpiado (se quita "Ajuste sobre el presupuesto/pedido"). Los
  descuentos van además a `payload.discount` global y se añade un item
  informativo "DESCUENTOS APLICADOS: …".

## Multi-cantidad

- Estimate: una línea Holded por fila con `Q1, Q2, …` (contador global),
  `units=1`, `subtotal=row.outs[Price]` (fallback `row.price`). Fuerza
  `shipping: 'hidden'`.
- Order: solo la cantidad aprobada (la fila multi se colapsa).

## Compuestos

- Descripción: bloques `── Alias ──` por componente activo, prompts
  visibles, **filtrando los que ya están en el padre** (mismo `label:value`).
- Precio: `outputs[type=Price]` o fallback `item.price` (suma de
  componentes activos).

## Visibilidad de prompts (filtros aplicados)

1. `product_prompt_settings.hide_in_documents` o `admin_only`.
2. `product_prompt_settings.hide_when_value` (match exacto, normalizado).
3. Visibilidad dinámica EasyQuote (`visibleWhen`/`hiddenWhen`) vía
   `isVisiblePromptDef` con `valuesMap` enriquecido por `def.id` y label.

## Cantidad (units) — solo desde prompts

1. Prompt con `is_quantity = true` (resolviendo cell ref → label vía
   `defsMap` de EasyQuote).
2. Heurística por etiqueta (`UNIDADES|CANTIDAD|EJEMPLAR|QTY`).
3. Custom: prompt de cantidad. Si `unit_price=0` → `units=1`.

## Validaciones de bloqueo (frontend)

- `customer.holded_id` obligatorio para `sent`/`approved` cuando hay
  Holded activa con modo que exporta estimates.
- Cross‑tenant: `customer.organization_id` debe coincidir con el del quote.

## Adjuntos

- Bucket privado `document-attachments` (5×10MB). Subida automática tras
  `holded-export-order`, manual desde `DocumentAttachments` mediante
  `holded-attach-document`. `multipart/form-data` con la Holded API.

## Mapas de campos persistidos

- `quotes`: `holded_estimate_id`, `holded_estimate_number`, `holded_id`.
- `sales_orders`: `holded_document_id`, `holded_document_number`.
- `customers`: `holded_id`, `source='holded'`.

## Checklist regresión obligatorio (ver doc §9)

Probar siempre los 3 export_modes, ambos casos T7/T8 vs T1‑T6, multi,
compuesto, custom, decimales (no 2), outputs ausentes, adjuntos,
salesChannelId del creador, reenvío sin downgrade de status.
