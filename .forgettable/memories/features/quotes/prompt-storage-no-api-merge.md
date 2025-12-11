# Prompts Guardados NO Deben Fusionarse con API

## Problema Recurrente
Al cargar artículos de presupuestos guardados (quote_items), el código intentaba fusionar los prompts guardados con TODOS los prompts del producto desde la API de EasyQuote. Esto causaba que prompts que el usuario nunca configuró aparecieran en las exportaciones a Holded y en los PDFs.

## Regla Crítica
**Los prompts guardados en quote_items.prompts son DEFINITIVOS**. Nunca deben fusionarse ni mezclarse con los prompts del API del producto.

## Ubicación del Código Problemático
Archivo: `src/components/quotes/QuoteItem.tsx`
En el useEffect que se ejecuta cuando `pricing` cambia (aproximadamente líneas 634-694).

## Código Incorrecto (NO USAR)
```typescript
// ❌ INCORRECTO - Fusiona prompts del API con guardados
if (initialData && hasPerformedInitialLoad) {
  pricing.prompts.forEach((prompt: any) => {
    if (!(prompt.id in mergedValues)) {
      mergedValues[prompt.id] = { ... }; // Añade prompts faltantes
    }
  });
}
```

## Código Correcto
```typescript
// ✅ CORRECTO - Mantiene solo los prompts guardados
if (initialData && hasPerformedInitialLoad && Object.keys(promptValues).length > 0) {
  console.log("✅ Artículo guardado - usando prompts DEFINITIVOS guardados, sin fusionar con API");
}
```

## Por Qué Es Importante
1. Los prompts guardados representan la configuración FINAL del usuario
2. Al exportar a Holded, solo deben aparecer los prompts configurados
3. Añadir prompts del API corrompe los datos y muestra información irrelevante al cliente
4. Este problema ha ocurrido múltiples veces y debe evitarse permanentemente

## Flujo Correcto
1. Usuario configura producto → guarda prompts definitivos
2. Al cargar artículo guardado → usar prompts guardados TAL CUAL
3. Al exportar → mostrar SOLO prompts guardados
4. El API se usa solo para obtener precio/outputs actualizados, NO para añadir prompts
