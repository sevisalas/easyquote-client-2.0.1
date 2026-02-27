
# Cambio: Exportar a Holded solo al aprobar (no al enviar)

## Resumen del cambio

Actualmente, el presupuesto se exporta a Holded cuando su estado cambia a **"enviado"**. El nuevo comportamiento sera:

- **Estado "enviado"**: Solo cambia el estado del presupuesto internamente. **No se exporta nada a Holded**.
- **Estado "aprobado"**: Al aprobar, ocurren dos cosas simultaneas:
  1. Se exporta el **presupuesto** a Holded (solo con los items aprobados)
  2. Se genera el **pedido** y se exporta a Holded (esto ya ocurre)

## Archivos a modificar

### 1. `src/pages/QuoteDetail.tsx`
- **Eliminar** la exportacion a Holded en `updateStatusMutation` cuando `status === 'sent'` (lineas 336-354, y el manejo en onSuccess lineas 356-363)
- **Eliminar** el boton "Reenviar a Holded" que aparece en estado `sent` (lineas 584-609)
- Cambiar el texto del boton de "Enviar a Holded" a simplemente **"Enviar"** (linea 579)
- **Mover** la logica de exportar presupuesto a Holded al flujo de aprobacion (o delegarla al hook `useQuoteApproval`)

### 2. `src/pages/QuoteNew.tsx`
- **Eliminar** la exportacion a Holded cuando `status === 'sent'` (lineas 538-568)
- Cambiar el texto del boton de "Guardar y enviar a Holded" a **"Guardar y enviar"** (linea 778)

### 3. `src/pages/QuoteEdit.tsx`
- **Eliminar** la exportacion a Holded en `handleStatusChange` cuando `newStatus === 'sent'` (lineas 745-763)
- Cambiar el texto del boton de "Enviar a Holded" a **"Enviar"** (linea 881)

### 4. `src/hooks/useQuoteApproval.ts`
- **Agregar** la exportacion del presupuesto a Holded (`holded-export-estimate`) al flujo de aprobacion, **antes** de la exportacion del pedido
- El presupuesto exportado reflejara solo los items aprobados (los `selectedItemIds`), que es exactamente lo mismo que se envia como pedido
- La exportacion del pedido (`holded-export-order`) ya existe y se mantiene igual

### 5. `src/pages/QuoteDetail.tsx` (aprobacion)
- Eliminar la validacion de `customerMissingHoldedId` para el estado `sent` (mantenerla solo para `approved`)
- Agregar un boton "Reenviar a Holded" en estado `approved` (en lugar de en `sent`)

## Flujo resultante

```text
Borrador --> Enviado --> Aprobado
                          |
                          +--> Exporta presupuesto a Holded (solo items aprobados)
                          +--> Genera pedido
                          +--> Exporta pedido a Holded
```

## Detalle tecnico

En `useQuoteApproval.ts`, justo antes del bloque existente `if (canExportOrders)`, se agregara:

```typescript
// Export quote (estimate) to Holded with only approved items
if (canExportQuotes) {
  try {
    const { error } = await supabase.functions.invoke('holded-export-estimate', {
      body: { quoteId }
    });
    if (error) console.error('Error exporting estimate to Holded:', error);
  } catch (err) {
    console.error('Error exporting estimate to Holded:', err);
  }
}
```

El hook necesitara acceso a `canExportQuotes` desde `useHoldedIntegration` (actualmente solo usa `canExportOrders`).

## Lo que NO cambia
- El edge function `holded-export-estimate` no necesita cambios (ya exporta el presupuesto completo)
- El edge function `holded-export-order` no necesita cambios
- La logica de seleccion de items y cantidades en la aprobacion se mantiene igual
- La validacion de `holded_id` del cliente se mantiene, pero solo se aplica al aprobar
