

## Diagnóstico: Por qué los resultados difieren del Excel

### Problema identificado

Hay **dos capas** que eliminan prompts antes de que lleguen al motor Syncfusion:

1. **Frontend** (líneas 573-576): Solo incluye prompts con `currentValue !== null/undefined`. Si el API GET inicial devuelve 16 prompts pero 3 tienen `currentValue: null`, solo se guardan 13 valores. Cuando el usuario modifica algo y se hace el PATCH, esos 3 prompts no se envían.

2. **Edge function** (líneas 120-124): Filtra y descarta strings vacíos (`""`). Si el frontend envía `""` para un prompt, la edge function lo elimina antes de enviarlo al API.

**Resultado**: El PATCH llega a Syncfusion con **menos prompts** de los que tiene el Excel. Syncfusion usa valores cacheados/residuales para los prompts faltantes, que pueden diferir de los defaults del Excel local.

Los logs lo confirman: el producto tiene **16 prompts** pero solo se envían **13** en cada PATCH.

### Plan de corrección

#### 1. Edge function: no descartar strings vacíos, convertirlos a `0`
**Archivo**: `supabase/functions/easyquote-pricing/index.ts`

En el filtro de inputs (líneas 120-124), cambiar:
```typescript
// Antes: se descarta
if (trimmed === "") {
  return false;
}

// Después: se convierte a 0
if (trimmed === "") {
  input.value = 0;
  return true;
}
```

#### 2. Frontend: incluir TODOS los prompts, no solo los que tienen currentValue
**Archivo**: `src/pages/ProductTestPage.tsx`

En la carga inicial (líneas 571-577), para prompts sin `currentValue`, usar el primer valor de `valueOptions` o `0` para numéricos:
```typescript
(pricingData?.prompts || []).forEach((prompt) => {
  if (prompt.currentValue !== undefined && prompt.currentValue !== null) {
    currentValues[prompt.id] = prompt.currentValue;
  } else {
    // Incluir default para que no se pierda en el PATCH
    if (prompt.valueOptions?.length > 0) {
      currentValues[prompt.id] = prompt.valueOptions[0];
    } else if (prompt.promptType === "Number" || prompt.promptType === "Quantity") {
      currentValues[prompt.id] = prompt.minimum ?? 0;
    }
  }
});
```

En la construcción del PATCH (líneas 643-667), asegurar que los prompts sin valor en `promptValues` se incluyan con su `currentValue` del API o un default.

### Alcance
- 2 archivos: `easyquote-pricing/index.ts` + `ProductTestPage.tsx`
- Sin cambios en base de datos
- La edge function se redesplega automáticamente

