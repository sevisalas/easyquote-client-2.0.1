# Prompts Guardados NO Deben Fusionarse con API

## Problema Recurrente
Al cargar artículos de presupuestos guardados (quote_items), el código sobrescribía los prompts guardados con TODOS los prompts del producto desde la API de EasyQuote. Esto causaba que prompts que el usuario nunca configuró aparecieran en las exportaciones a Holded y en los PDFs.

## Regla Crítica
**Los prompts guardados en quote_items.prompts son DEFINITIVOS**. Nunca deben sobrescribirse ni mezclarse con los prompts del API del producto.

## Ubicación del Código Problemático
Archivo: `src/components/quotes/QuoteItem.tsx`

### Problema 1: useEffect de fusión (líneas ~634-668)
El useEffect que se ejecuta cuando `pricing` cambia NO debe fusionar prompts del API con los guardados.

### Problema 2: queryFn de pricing (líneas ~554-598) - CRÍTICO
La respuesta del API puede sobrescribir `promptValues` si la condición `isNewProduct` es true.
**La condición DEBE incluir `!initialData`** para evitar sobrescribir artículos guardados:

```typescript
// ✅ CORRECTO - Verifica que NO hay initialData
if (isNewProduct && data?.prompts && !initialData) {
  // Solo inicializar para productos REALMENTE nuevos
  setPromptValues(defaultValues);
}

// ❌ INCORRECTO - Puede sobrescribir artículos guardados
if (isNewProduct && data?.prompts) {
  setPromptValues(defaultValues);
}
```

## Por Qué Es Importante
1. Los prompts guardados representan la configuración FINAL del usuario
2. Al exportar a Holded, solo deben aparecer los prompts configurados
3. Añadir prompts del API corrompe los datos y muestra información irrelevante al cliente
4. Este problema ha ocurrido múltiples veces y debe evitarse permanentemente

## Flujo Correcto
1. Usuario configura producto → guarda prompts definitivos
2. Al cargar artículo guardado → usar prompts guardados TAL CUAL (nunca sobrescribir con API)
3. Al exportar → mostrar SOLO prompts guardados
4. El API se usa solo para obtener precio/outputs actualizados, NO para modificar prompts
