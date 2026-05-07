# Protocolo QA por versión

Checklist obligatorio antes de cerrar cualquier versión (x.y.z) que toque
presupuestos, pedidos, pricing, prompts, multi-cantidad, ajustes,
descripciones o integraciones (Holded, EasyQuote, WooCommerce, Portal B2B).

Si un bloque falla → **NO se publica la versión**. Anotar en CHANGELOG el
resultado de la QA y la versión validada.

---

## 0. Pre-flight (5 min)

- [ ] Build limpio sin errores TS.
- [ ] `version.json` actualizado y `Novedades.tsx` con la entrada nueva.
- [ ] Revisar memorias afectadas:
  - `process/regression-checklist-quotes-orders`
  - `process/holded-regression-protocol`
  - `architecture/pricing/calculation-pipeline-complete`
  - `integrations/holded/export-pipeline-complete`
- [ ] Identificar qué bloques de este protocolo afecta el cambio.

---

## 1. Conexión con la API EasyQuote (CRÍTICO — bloqueante)

La API es la fuente de verdad para precio, prompts activos y outputs.
Si esto falla, **nada más importa**.

- [ ] Diagnóstico: `Ajustes → Diagnóstico EasyQuote` responde OK para los
      api_user_id activos (al menos 1 por organización tipo: Campillo,
      Anebri, Reprotel, Demo).
- [ ] Crear presupuesto nuevo y seleccionar un producto simple:
  - GET inicial devuelve prompts + precio base.
  - Cambiar 1 prompt → PATCH devuelve precio nuevo y outputs nuevos.
  - El subset de prompts devueltos REEMPLAZA el estado local
    (no se acumulan prompts viejos).
- [ ] Repetir con un producto **compuesto** (libro tapa dura, agenda):
  - 1 PATCH por componente activo + 1 al padre si tiene Excel.
  - Precio compuesto = Σ componentes activos + padre.
  - Cambiar prompt en padre que afecta componente (ej. "Tapa dura" activa
    "Lomo") → componente reaparece con sus campos.
- [ ] Caché de 20 min de SpreadsheetPricingAPI: cambiar Excel en
      easyquote.cloud y verificar que tras el TTL se refleja.

## 2. Detalles de artículo en presupuesto (CRÍTICO)

- [ ] **Prompts visibles vs ocultos**:
  - Prompts marcados `is_hidden` no aparecen en UI normal.
  - Prompts marcados `admin_only` solo los ven admin/superadmin.
  - Prompts marcados `hide_in_documents` no salen en PDF ni Holded.
  - `force_result` aparece en sección "Opciones restrictivas".
- [ ] **Cantidad (`is_quantity`)**: el prompt marcado dicta la cantidad real
      del item. Cambiarlo actualiza la cantidad mostrada y el precio.
- [ ] **Descripción del artículo**:
  - Vacía → se autogenera al guardar (`description_manual = false`),
    excluye `No`, `0`, `SOLAPAS`, etiquetas internas (tarifa, forzar
    máquina, tira y retira, modelos…).
  - Editada manualmente → flag `description_manual = true`, en PDF se
    muestra SOLO la descripción (no prompts ni componentes).
  - Cambiar de producto → resetea `description_manual` a false.
- [ ] **Compuestos**: bloques `── Componente ──` con sus prompts.
- [ ] **Outputs**: outputs persistidos coinciden con los del último PATCH.

## 3. Precio y persistencia decimal (CRÍTICO)

- [ ] Abrir presupuesto existente, **guardar sin tocar nada** → total y
      `price` por item idénticos al céntimo. (Regresión histórica:
      presupuesto 640 cambió 1.845,75 € → 1.680 €.)
- [ ] Inputs `step="any"`, sin `toFixed(2)` ni `Math.round` en guardado.
- [ ] `quote_items.price`, `multi.rows[].totalStr`, `outputs[].value`,
      `quotes.final_price` preservan todos los decimales.

## 4. Tarifa de cliente (CRÍTICO)

- [ ] Cliente con tarifa: la tarifa se aplica SOLO al precio base del API.
- [ ] Ajustes (`net_amount`, `percentage`, `quantity_multiplier`,
      `capacity_divider`) NO llevan tarifa.
- [ ] `quote_additionals` NO llevan tarifa.
- [ ] En multi `%`: revertir tarifa antes del cálculo del porcentaje.
- [ ] Cambiar cliente con `_liveUpdated`/`tariffSignature` → fuerza
      recálculo.

## 5. Multi-cantidad

- [ ] Activar multi → 1 fila por cantidad, cada una con su precio API.
- [ ] Cambiar cantidad principal → sincroniza con Q1.
- [ ] Override `net_amount` por cantidad respetado al guardar.
- [ ] Botón "Igualar" funciona; ajustes `%` se calculan sobre base SIN
      tarifa por fila.
- [ ] Override de precio manual deshabilitado en multi.
- [ ] Persistir TODAS las filas aunque solo una esté seleccionada.

## 6. Ajustes (item_additionals y quote_additionals)

- [ ] Añadir/quitar ajustes de artículo y de presupuesto recalcula totales.
- [ ] `is_discount` invierte el signo. `is_active=false` no aplica.
- [ ] PDF Templates 7/8 (Campillo/Anebri):
  - item_additionals NO se muestran (integrados en precio).
  - quote_additionals SÍ como filas finales.

## 7. Aprobación de presupuesto → Pedido

- [ ] Aprobación usa precio almacenado en BD, **sin recalcular vía API**.
- [ ] Mantiene `item_additionals` y la cantidad seleccionada.
- [ ] Multi: solo la cantidad aprobada queda activa, las demás
      `accepted:false`, tachadas en histórico.
- [ ] Pedido creado mantiene `quote_id` (UUID), `composite_data`,
      `imposition`, prompts, outputs idénticos al presupuesto.
- [ ] Numeración de pedido aislada por `organization_id`.
- [ ] Campillo/Anebri: 1 pedido por item, ignora additionals globales.

## 8. Integración Holded (CRÍTICO si la org la usa)

- [ ] Verificar `organization_integration_access` + `integrations(name='Holded')`:
      `is_active`, `access_token_encrypted`, `configuration.export_mode`.
- [ ] Cliente sin `holded_id` → bloquea aprobación/envío.
- [ ] Modo `estimates_on_approval` (Campillo/Anebri): al aprobar quote se
      rellenan `holded_estimate_id` Y `holded_document_id` en BD.
- [ ] Modo `orders_only`: solo se exporta el pedido.
- [ ] Modo `all`: presupuesto y pedido.
- [ ] Botón "Enviar a Holded" aparece SOLO si `holded_document_id IS NULL`,
      es admin/gestor, vista administrativa, integración activa.
- [ ] Botón "Actualizar en Holded" (PUT) tras export inicial.
- [ ] Sync de status: ERP no revierte estado local `approved` a `sent`.
- [ ] Adjuntos: máx 5, 10MB, manual y automático.
- [ ] Compuestos: incluyen líneas `── Component ──`. Si prompt componente
      es idéntico al padre → omitido en ERP.
- [ ] Multi-cantidad: solo se exporta la cantidad principal/aprobada.
- [ ] Prompts ocultos por visibilidad NO se exportan a Holded.
- [ ] Etiquetas resueltas (no `B19`, no cell refs) en descripciones ERP.
- [ ] **Campillo Formación**: explícitamente excluido de Holded.
- [ ] Importar clientes: upsert por `holded_id` + `organization_id`.
- [ ] Tras desplegar cambios en `approve-quote`/`holded-export-*`:
      revisar logs de Edge Functions (sin try/catch silenciosos).
- [ ] Query rápido de salud:
      `SELECT id, document_number, status, holded_document_id FROM sales_orders
      WHERE created_at > now()-interval '1 day' AND holded_document_id IS NULL;`

## 9. Otras integraciones

- [ ] **WooCommerce**: pre-filtrado por metadata local; sync de productos
      no rompe configuración existente.
- [ ] **Portal B2B**: login funciona, autoservice usa
      `_shared/b2b-pricing-core.ts`, prompts ocultos respetados, tarifa
      aplicada solo al base.
- [ ] **SMTP**: envío de email con plantilla por organización, variables
      `{{numero}}`, `{{cliente}}`, `{{boton_pdf}}` con color corporativo.
- [ ] **Imposición**: backfill desde quote a sales order, por componente.

## 10. PDFs y documentos

- [ ] Cada plantilla activa por organización renderiza sin clipping.
- [ ] Templates 7/8: tabla 3 columnas, multi-qty bajo descripción.
- [ ] OT (Campillo/Anebri): 1 página por item, `show_in_ot=true`,
      Observaciones visibles.
- [ ] PDF respeta `hide_in_documents`, `admin_only`, sanitización.
- [ ] TOTAL oculto si solo hay 1 item sin impuestos/descuentos/globales.
- [ ] Manual description: PDF muestra SOLO la descripción.

## 11. RBAC y multi-tenant

- [ ] Admin ve todo; Gestor sin Excel/Producción config; Comercial solo
      sus propios; Operador solo Producción.
- [ ] RLS por `organization_members`. Probar con 2 organizaciones
      hermanas (mismo `api_user_id`) que comparten config de producto pero
      no datos.
- [ ] Numeración independiente por `organization_id`.
- [ ] Document numbering: duplicar usa `next_document_number` RPC.

## 12. Producción

- [ ] Panel `/panel-produccion` carga, view switcher OK.
- [ ] Estado de pedido se sincroniza con tareas (en curso/terminado).
- [ ] Outputs persistidos en BD, sin auto-sync API al cargar.
- [ ] Edición de pedido no-borrador requiere motivo y log.

## 13. UI / Versión

- [ ] Cambio de viewport (móvil/tablet/desktop) sin roturas.
- [ ] `useVersionCheck` detecta nueva `version.json` y muestra banner.
- [ ] WhatsNewDialog abre con la entrada de la nueva versión.

---

## Cómo registrar la QA

Al final de cada release, añadir al CHANGELOG bajo la versión:

```
## [x.y.z] - YYYY-MM-DD
### QA
- Bloques validados: 1, 2, 3, 4, 8 (Campillo + Anebri)
- Validado por: <persona>
- Incidencias detectadas: <ninguna | lista>
```

Si un bloque NO se valida (porque el cambio no lo toca), indicarlo
explícitamente. **No se asume**: o se marca o se valida.

## Reglas de oro (no negociables)

1. La API es la única fuente de verdad de prompts activos y precio.
2. Prompts guardados en BD NUNCA se sobrescriben con respuesta API al
   cargar (salvo producto realmente nuevo sin `initialData`).
3. Tarifa SOLO al precio base. Nunca a ajustes.
4. Sin `toFixed`/`round` en camino de guardado.
5. Holded: verificar nombres reales de tabla/columna en
   `information_schema` antes de tocar export.
6. Try/catch "best-effort" silenciosos = trampas. Loguear siempre.
7. Si el usuario reporta "no se sube a Holded": consultar BD primero
   (`holded_*_id IS NULL`), después tocar código.