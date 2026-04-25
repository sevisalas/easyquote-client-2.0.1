# Integración con Holded — Referencia completa

Documento de referencia (fuente de verdad) sobre cómo se exporta a Holded
desde EasyQuote: contactos, presupuestos (estimates), pedidos (sales orders),
adjuntos y peculiaridades por tenant. Va en paralelo a
`docs/calculo-precios-completo.md`: ese describe cómo se forma el precio,
este describe cómo se traslada a Holded.

> Reglas que NUNCA se rompen, aunque el cambio parezca inofensivo:
> 1. La API key es **por organización** (multi‑tenant) y se descifra siempre
>    con `decrypt_credential` desde `organization_integration_access`.
> 2. La aplicación de la **tarifa de cliente** y de los **ajustes** ya está
>    incorporada en `quote_items.price` / `outputs[type=Price]` / `multi.rows`
>    cuando llegamos a Holded. La función de exportación NO recalcula con
>    tarifa: solo lee precios ya almacenados (ver
>    `docs/calculo-precios-completo.md`).
> 3. Outputs son datos internos: **NUNCA** se envían a Holded.
> 4. Prompts marcados como `hide_in_documents`, `admin_only` o ocultos por
>    visibilidad dinámica de EasyQuote / `hide_when_value` se filtran tanto
>    en la descripción del item como en los componentes de compuestos.
> 5. La precisión decimal es la del API/usuario. Para Holded redondeamos a
>    **6 decimales** (máximo permitido por su API), nunca a 2.

## 1. Modelo de datos en BD

### 1.1 `integrations`
- Fila única por proveedor (`name = 'Holded'`).
- Es el catálogo global, no contiene credenciales.

### 1.2 `organization_integration_access` (1 fila por organización × integration)
| Campo | Uso |
|---|---|
| `organization_id` | Tenant. |
| `integration_id` | FK a `integrations` (Holded). |
| `access_token_encrypted` | **API key de Holded cifrada** (pgcrypto). |
| `is_active` | Si la integración está habilitada para el tenant. |
| `configuration` (jsonb) | Configuración por tenant. Hoy contiene `export_mode`. |

`isHoldedActive = is_active === true && access_token_encrypted IS NOT NULL`.
`hasHoldedAccess = existe la fila` (acceso a la pantalla, aunque no esté
configurada todavía).

### 1.3 `customers`
- `holded_id`: ID del contacto en Holded. **Obligatorio** para poder enviar
  cualquier documento (estimate u order). Sin él, las funciones lanzan
  `"No se encontró contactId de Holded para este cliente"`.
- `address`, `email`, `phone`: se envían como `contactAddress`,
  `contactEmail`, `contactPhone` para ayudar a Holded a auto‑rellenar el
  contacto si falta info.
- `source = 'holded'` se usa para el importador / cleanup.

### 1.4 `organization_members.cuenta_holded`
- Cuenta de ventas (`salesChannelId`) por usuario. La función toma la del
  **creador del documento** (`quote.user_id` / `order.user_id`), no la del
  usuario que pulsa "exportar". Esto permite atribuir comisiones por
  comercial dentro de un mismo tenant.

### 1.5 `holded_sales_accounts`
- Catálogo por tenant de cuentas de ventas (id de Holded + nombre + color +
  numeración contable). Sirve para que el admin pueda elegir entre opciones
  conocidas al asignar `cuenta_holded` a cada miembro.

### 1.6 `quotes` / `sales_orders`
- `holded_estimate_id`, `holded_estimate_number` en `quotes`.
- `holded_document_id`, `holded_document_number` en `sales_orders`.
- Tras exportar correctamente se rellenan, y son los IDs que usamos para
  PUT (`holded-update-order`), descargar PDF (`holded-download-pdf`),
  vincular adjuntos (`holded-attach-document`) y sincronizar números
  (`holded-sync-order-number`).

## 2. Modos de exportación por tenant (`export_mode`)

Configurado en `organization_integration_access.configuration.export_mode`.
Valores posibles:

| Modo | Estimate al **enviar** | Estimate al **aprobar** | Order al **aprobar** |
|---|---|---|---|
| `all` (default) | ✅ | ❌ (ya estaba) | ✅ |
| `estimates_on_approval` | ❌ | ✅ | ✅ |
| `orders_only` | ❌ | ❌ | ✅ |

En el frontend (`useHoldedIntegration.ts`):
- `canExportQuotesOnSend = isHoldedActive && exportMode === 'all'`
- `canExportQuotesOnApproval = isHoldedActive && exportMode in ('all','estimates_on_approval')`
- `canExportQuotes = isHoldedActive && exportMode !== 'orders_only'` (UI:
  avisos de `holded_id`, botón "reenviar a Holded").
- `canExportOrders = isHoldedActive` (siempre, si la integración está
  activa).

Quien decide qué llamada hacer es **siempre el frontend** (`QuoteNew`,
`QuoteEdit`, `QuoteDetail`, `useQuoteApproval`, `SalesOrderNew`,
`SalesOrderDetail`). Las edge functions no consultan `export_mode`.

## 3. Edge functions Holded

| Función | Verbo Holded | Quién la llama | Para qué |
|---|---|---|---|
| `holded-import-customers` | GET contacts | `Clientes`, `Integrations` | Sincroniza contactos tipo cliente como `customers` (upsert por `holded_id`). |
| `holded-import-contacts` | GET contacts | `QuoteNew`, `SalesOrderNew`, `Integrations` | Variante usada al crear documentos para refrescar la lista. |
| `holded-export-estimate` | POST `documents/estimate` | `QuoteNew`, `QuoteEdit`, `QuoteDetail`, `useQuoteApproval` | Crea el presupuesto en Holded. |
| `holded-export-order` | POST `documents/salesorder` | `SalesOrderNew`, `useQuoteApproval` | Crea el pedido en Holded. |
| `holded-update-order` | PUT `documents/salesorder/{id}` | `SalesOrderDetail` | Reenvía cambios de un pedido ya exportado. |
| `holded-attach-document` | POST `…/{id}/attach` | `DocumentAttachments`, `holded-export-order` | Adjunta PDFs / imágenes al documento Holded. |
| `holded-sync-order-number` | GET `salesorder/{id}` | `SalesOrdersList` | Recupera `invoiceNum` para pedidos exportados sin número guardado. |
| `holded-download-pdf` | GET `…/pdf` | UI varias | Devuelve PDF firmado del documento. |
| `holded-audit-document-contacts` | GET docs | `Integrations` | Auditoría: detecta documentos en Holded que apuntan a contactos eliminados. |
| `holded-reassign-document-contacts` | PUT docs | `Integrations` | Repara los anteriores. |
| `disable-holded-integration` | — | `Integrations` | Desactiva la integración (limpia token). |
| `save-holded-api-key` | — | `Integrations` | Cifra y guarda la API key. |
| `holded-zapier-webhook` / `holded-n8n-webhook` | — | externos | Entradas opcionales para automatizaciones (no son parte del flujo estándar). |

## 4. Pipeline de exportación de PRESUPUESTO (`holded-export-estimate`)

1. **Auth** del usuario, comprobando que pertenece a `quote.organization_id`
   (owner u member).
2. **Carga** `quotes`, `quote_items` (filtrados opcionalmente por
   `approvedItemIds` si viene del flujo de aprobación) y
   `quote.quote_additionals` (los ajustes a nivel de presupuesto viven en
   ese JSONB del propio `quotes`, no en una tabla aparte).
3. **Cliente**: lee `customers.holded_id` y verifica que el cliente
   pertenece a la misma organización que el presupuesto.
4. **Cuenta de ventas**: `organization_members.cuenta_holded` del creador.
5. **API key**: lee `organization_integration_access` activo para
   `Holded` + `decrypt_credential`.
6. **Token EasyQuote** (best‑effort): se obtiene con
   `easyquote-auth` para poder consultar las definiciones de prompts del
   producto y resolver visibilidad dinámica + etiquetas humanas
   (`promptText`).
7. **Configuración por tenant**:
   - `organizations.hide_all_prompts_in_documents` → si `true`, en lugar
     de armar la descripción a partir de prompts se usa
     `quote_items.description` directo.
   - `pdf_configurations.selected_template`:
     - `7` (Campillo) o `8` (Anebri) → `hideItemAdjustmentsInHolded = true`
       (los ajustes de ARTÍCULO no aparecen como texto en la descripción
       de Holded; van integrados en el precio del item).
     - El resto de templates: el TEXTO de los ajustes sí se añade a la
       descripción del item, pero el PRECIO siempre va integrado en el
       item (nunca como línea suelta).
   - `hideAdjustmentsInHolded = false` SIEMPRE → los ajustes a nivel de
     PRESUPUESTO se muestran como líneas separadas en Holded
     (ver `mem://features/pdf/adjustment-visibility-rules`).
8. **Visibilidad de prompts** (`product_prompt_settings` × `api_user_id`):
   - `hide_in_documents = true` o `admin_only = true` → se excluyen de
     descripciones (también para componentes de compuestos).
   - `hide_when_value` → se ocultan cuando el valor coincide.
   - Visibilidad dinámica devuelta por EasyQuote (`visibleWhen`,
     `hiddenWhen`) → se evalúa con `isVisiblePromptDef` cruzando contra el
     `valuesMap` enriquecido con `def.id` y `def.label`.
9. **Descripción de cada item**:
   - **Single**: lista `label: value` de prompts visibles, ordenados por
     `order`. Para producto custom (`__CUSTOM_PRODUCT__`) se usa
     `item.description` directo y los prompts `cantidad` / `precio
     unitario` mapean a `units` y `subtotal`.
   - **Multi‑cantidad** (`item.multi.rows.length > 1`): se crea **una línea
     Holded por cada fila** (`Q1`, `Q2`, … con contador global). El precio
     viene de `row.outs[type=Price]`, con fallback a `row.price`. Cada línea
     lleva `units = 1` y `subtotal = precio total de esa cantidad`. Se
     fuerza `shipping = 'hidden'` en el payload final si hay multi en algún
     item.
   - **Compuestos**: se añade `── Alias ──` por componente activo y se
     listan sus prompts visibles, **filtrando los que ya aparecen en el
     padre** (mismo `label:value`) para no duplicar campos propagados.
10. **Cantidad (`units`)**: se determina **solo desde prompts**:
    1. Prompt marcado `is_quantity = true` en `product_prompt_settings`.
    2. Heurística por etiqueta (`UNIDADES|CANTIDAD|EJEMPLAR|QTY`).
    3. En custom: el prompt de cantidad. Si `unit_price = 0` (todo viene de
       ajustes fijos) se mantiene `units = 1` para no dividir el total.
    Nunca se coge la cantidad de outputs.
11. **Precio del item (`subtotal`, unitario)**:
    - Single: `outputs[type=Price]` → fallback `item.price`.
    - Compuesto: si `output Price = 0`, fallback a `item.price` (suma de
      componentes activos ya almacenada).
    - Custom: `customQuantity * customUnitPrice` para evitar duplicar
      `item_additionals` ya integrados en `item.price`.
    - `unit = total / units` redondeado a 6 decimales.
12. **`item_additionals`**:
    - **Descuentos** (`is_discount` o valor negativo): se acumulan en
      `discountAmount` (€) por item. Tipos soportados: `net_amount`,
      `percentage`. Se publican en `itemData.discount`.
    - **No descuentos**: se aplican al `totalPrice` del item según tipo
      (`net_amount`, `percentage`, `quantity_multiplier`,
      `capacity_divider`). Mismas fórmulas que en
      `docs/calculo-precios-completo.md`.
    - El TEXTO de los ajustes en la descripción solo se añade si
      `hideItemAdjustmentsInHolded === false` (tenants distintos a 7/8).
13. **`quote_additionals`** (ajustes globales del presupuesto):
    - No descuentos → línea independiente con nombre limpiado (se quita
      "Ajuste sobre el presupuesto/pedido"), `units = 1`,
      `taxes: ["s_iva_21"]`. Soporta `percentage`,
      `quantity_multiplier`/`multiplier` (sobre el subtotal acumulado) y
      `net_amount`.
    - Descuentos → se suman a `globalDiscount` (€) y se reflejan en
      `payload.discount` (Holded lo trata como descuento global de
      cabecera). Además, se añade un item informativo de subtotal 0:
      `"DESCUENTOS APLICADOS: <nombre1>, <nombre2>"` para que quede claro
      qué se ha aplicado.
14. **Payload final**:
    ```jsonc
    {
      "docType": "estimate",
      "date": <unix>,
      "contactId": "<holded_id>",
      "desc": "<quote.description>",
      "notes": "<quote.notes>",
      "items": [...],
      "paymentMethodId": "5ad06f6a2e1d93408570743e",
      "salesChannelId": "<cuenta_holded del creador>",
      "shipping": "hidden",                  // si hay multi
      "contactAddress|Email|Phone": "...",   // si existen
      "discount": <globalDiscount>           // si > 0
    }
    ```
15. **Persistencia**:
    - Guarda `holded_estimate_id`, `holded_estimate_number`, `holded_id`.
    - Cambia `quotes.status` a `'sent'` SOLO si no estaba `'approved'`
      (protección anti‑downgrade, ver
      `mem://integrations/holded/status-synchronization-protection`).

## 5. Pipeline de exportación de PEDIDO (`holded-export-order`)

Casi idéntico al de presupuestos pero apunta a `documents/salesorder` y
trabaja con `sales_orders` + `sales_order_items` + `sales_order_additionals`.
Diferencias clave:

- Cuando el pedido viene de un presupuesto aprobado, se loguea el enlace
  con `holded_estimate_id` (no se envía un campo de "from" porque la API
  POST no lo soporta).
- Se añade `deliveryDate` si existe.
- Tras crear el documento, descarga los `document_attachments` del pedido y
  los sube uno a uno a `…/salesorder/{id}/attach` (ver §7).
- Guarda `holded_document_id` y `holded_document_number`.

`holded-update-order` (PUT) reusa la misma lógica de items pero **no
vuelve a aplicar descuentos globales** (la API PUT de Holded ignora
silenciosamente `from`, `customFields`, `approvedAt` y `shipping`, así que
se ha eliminado ese código muerto).

## 6. Multi‑cantidad y Holded

- Estimates: una línea por cantidad (`Q1`, `Q2`, …) con `units=1` y
  `subtotal=precio total de esa fila`. Mantiene la compatibilidad con la
  visualización del cliente sin perder los precios escalonados.
- Sales orders: solo se exporta la cantidad ELEGIDA al aprobar (la fila
  multi se colapsa), evitando duplicados (ver
  `mem://integrations/holded/multi-quantity-export-behavior`).

## 7. Adjuntos (`document_attachments`)

- Almacenados en bucket `document-attachments` (privado).
- Hasta 5 archivos × 10 MB cada uno por documento.
- `holded-attach-document` se llama desde el componente `DocumentAttachments`
  (UI manual) o automáticamente desde `holded-export-order` tras la
  creación del salesorder.
- Se descargan con service role y se hace `multipart/form-data` con la
  Holded API.

## 8. Reglas de bloqueo y validación previa

1. **`holded_id` obligatorio en `customers`**: no se permite enviar a
   estado `sent`/`approved` si el cliente no tiene contacto en Holded
   (`mem://business-logic/quote-export-blocking-rules`).
2. **Tenant excluido**: `Campillo Formación` no usa Holded
   (`mem://constraints/integrations/campillo-formacion-holded-exclusion`).
   La UI esconde botones según `isHoldedActive`, no por nombre — ese
   tenant simplemente no tiene la integración activa.
3. **No sobrescribir status**: el estimate POST nunca cambia `approved` a
   `sent`. Si la exportación falla tras la aprobación, el pedido sigue
   creándose en local; el reenvío manual desde QuoteDetail está disponible
   mientras `canExportQuotes` sea `true`.
4. **Cliente ↔ presupuesto**: el `holded-export-estimate` rechaza el envío
   si `customer.organization_id !== quote.organization_id` (defensa
   anti‑cross‑tenant).

## 9. Checklist de regresión cuando tocas Holded

1. ¿Sigue funcionando con `export_mode = all` (estimate en `sent` + order
   en `approved`)?
2. ¿Y con `estimates_on_approval` (estimate solo al aprobar)?
3. ¿Y con `orders_only` (no se manda estimate nunca)?
4. Tenant T7/T8: los ajustes de ITEM **no** aparecen como TEXTO en la
   descripción; los ajustes de PRESUPUESTO sí van como líneas separadas.
5. Tenant normal (T1‑T6): los ajustes de ITEM se reflejan en el precio del
   item Y como texto en su descripción; los de PRESUPUESTO van como líneas
   separadas.
6. Multi‑cantidad: una línea por `Q*` con su precio real
   (`row.outs[type=Price]`).
7. Composite: se añaden bloques `── Alias ──` solo con prompts visibles y
   sin duplicar prompts del padre.
8. Custom product: precio = `qty × unit_price`, sin doble aplicación de
   ajustes.
9. Decimales: `subtotal` en Holded redondea a 6, **nunca** a 2. La fuente
   (`outputs[type=Price]`, `row.price`, `item.price`) mantiene su
   precisión completa.
10. Outputs jamás se envían a Holded.
11. Adjuntos: se suben todos los `document_attachments` del documento.
12. `salesChannelId` se toma de `cuenta_holded` del creador, no del usuario
    actual.
13. Re‑envío desde `QuoteDetail` actualiza `holded_estimate_id` y
    `holded_estimate_number`, sin tocar `status` si ya está `approved`.
