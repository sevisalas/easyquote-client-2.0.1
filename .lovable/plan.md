## Objetivo

Convertir el Portal B2B en un **autoservicio real** para el cliente:
elige producto → configura cantidad/opciones → **ve precio al instante** (motor EasyQuote con su tarifa) → acepta → **se genera el presupuesto automáticamente** sin intervención del comercial.

---

## Lo que se ELIMINA

- Tabla `b2b_quote_requests` (formulario de petición manual — no aporta nada).
- Página admin `/b2b/solicitudes` y su navegación.
- Pestaña "Solicitar presupuesto" del portal cliente.
- Cualquier flujo que dependa de que el comercial haga el presupuesto a mano.

---

## Lo que se AÑADE / CAMBIA

### 1. Catálogo B2B (admin) — ampliar `b2b_catalog_items`

Nuevas columnas:
- `product_id` (uuid → producto real de EasyQuote, obligatorio)
- `default_prompts` (jsonb): valores prefijados que el cliente NO puede tocar (acabados, sustrato, etc.)
- `exposed_prompt_ids` (text[]): los prompts que el cliente SÍ ve y puede modificar (típicamente: cantidad, y opcionalmente medida o 1-2 acabados)
- `min_quantity`, `max_quantity` (opcionales, para limitar el rango)

Editor admin (`/b2b/catalogo`):
- Selector de producto EasyQuote
- Tras elegir producto, carga sus prompts vía `easyquote-master-files`
- Para cada prompt: marcar "Fijo" (con valor predefinido) o "Visible al cliente"
- Guardar en `b2b_catalog_items`

### 2. Portal cliente — pestaña "Catálogo" (rediseño)

Tarjetas de producto → al pulsar **"Configurar"** se abre un panel con:
- Solo los `exposed_prompt_ids` (típicamente cantidad)
- **Precio calculado en vivo** llamando a `easyquote-pricing` (PATCH) con la combinación: `default_prompts` + valores que elige el cliente
- Aplicar **tarifa del cliente** (sistema de tariffs ya existente) sobre el precio devuelto
- Botón **"Pedir este presupuesto"** → llama a una nueva edge function

### 3. Edge function `b2b-create-quote`

Recibe: `{ catalog_item_id, prompts_overrides, customer_id (del portal user) }`

Flujo:
1. Carga `b2b_catalog_items` → obtiene `product_id`, `default_prompts`, `organization_id`
2. Funde `default_prompts` + `prompts_overrides`
3. Llama `easyquote-pricing` para precio final autoritativo
4. Aplica tariff del cliente
5. Crea `quotes` + `quote_items` con todos los datos (igual que lo haría el comercial)
6. `status = 'sent'` (o `'pending_review'` si el admin lo marca opcional)
7. Devuelve `quote_id` → el cliente lo ve en "Mis presupuestos" listo para aprobar

### 4. Flag de seguridad por organización

`organizations.b2b_self_service_enabled` (bool, default false). Si está apagado, el botón crea una solicitud "pendiente revisión" en lugar del presupuesto definitivo. Así el comercial mantiene control si quiere.

---

## Esquema técnico (resumen)

```
b2b_catalog_items (ALTER):
  + product_id uuid
  + default_prompts jsonb default '{}'
  + exposed_prompt_ids text[] default '{}'
  + min_quantity int, max_quantity int

DROP: b2b_quote_requests (+ políticas)

organizations:
  + b2b_self_service_enabled boolean default true

Edge function: b2b-create-quote (verify_jwt=false, valida portal token)
```

---

## Resultado para el cliente

1. Entra al portal.
2. Catálogo → "Tarjetas visita" → configurar → 500 uds.
3. Ve **"427,30 €"** al instante.
4. Pulsa "Pedir presupuesto".
5. En 2 segundos lo tiene en "Mis presupuestos", listo para aprobar y descargar PDF.

Eso sí es un add-on de pago. Sin esperas, sin emails, sin llamadas.

---

## Pasos de implementación

1. Migración: alter `b2b_catalog_items`, drop `b2b_quote_requests`, add flag a `organizations`.
2. Rehacer editor admin `/b2b/catalogo` con selector de producto + configurador de prompts.
3. Eliminar `/b2b/solicitudes` y rutas/menús asociados.
4. Crear edge function `b2b-create-quote`.
5. Rehacer pestaña "Catálogo" del portal cliente con configurador + pricing en vivo + botón "Pedir presupuesto".
6. Quitar pestaña "Solicitar presupuesto" del portal.
