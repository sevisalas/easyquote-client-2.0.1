

# Plan: Validación de incongruencia de hojas en campos de entrada

## Problema identificado

El usuario configuró el campo "Tira y retira" (B23) en una hoja diferente al resto de campos del producto "Cubierta", lo que causó que el campo no apareciera en el cálculo. Este es un error común que debería detectarse automáticamente.

## Solución propuesta

Añadir una validación visual que alerte al usuario cuando un campo de entrada está configurado en una hoja diferente a la mayoría de los campos del mismo producto.

## Diseño de la validación

### Lógica de detección

1. Calcular la "hoja dominante" del producto: la hoja que usa la mayoría de los campos
2. Identificar campos "anómalos": aquellos que usan una hoja diferente a la dominante
3. Mostrar un indicador visual de advertencia en esos campos

### Ubicación en la UI

En `ProductManagement.tsx`, sección de edición de campos de entrada (prompts):
- Mostrar un icono de advertencia naranja junto al selector de hoja cuando difiere de la dominante
- Añadir tooltip explicativo: "Este campo usa una hoja diferente al resto ({hojaDominante}). Verifica si es intencional."

### Cuándo se activa

- Al renderizar la lista de prompts
- Cuando el usuario cambia la hoja de un prompt (validación en tiempo real)

## Cambios en código

### Archivo: `src/pages/ProductManagement.tsx`

**1. Nueva función helper para detectar incongruencias (línea ~600)**

Función que analiza todos los prompts y determina:
- La hoja más usada (dominante)
- Qué prompts están en hojas diferentes

**2. Indicador visual en el selector de hoja de cada prompt (línea ~2545-2572)**

Añadir junto al `Select` de hoja:
- Icono `AlertTriangle` de Lucide (color naranja/amber)
- Tooltip con explicación
- Solo visible cuando el prompt está en hoja diferente a la dominante

**3. Alerta al guardar/actualizar un prompt (opcional)**

Cuando el usuario guarda un prompt con hoja diferente, mostrar un toast de advertencia (no bloquear, solo informar).

## Mockup visual

```text
Campos de entrada actuales:
┌────────────────────────────────────────────────────────────────┐
│ ▪ Cantidad ejemplares                                          │
│   Hoja: [Datos ▾]  Rótulo: [B5]  Valor: [C5]  Orden: [1]       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ▪ Tira y retira                                        ⚠️      │
│   Hoja: [Otros ▾] ⚠️  Rótulo: [B23]  Valor: [C23]  Orden: [8]  │
│   └──> Tooltip: "Hoja diferente al resto (Datos). Verifica."  │
└────────────────────────────────────────────────────────────────┘
```

## Criterios de activación

| Condición | Acción |
|-----------|--------|
| 80%+ de prompts en una hoja | Esa es la hoja dominante |
| Prompt en hoja diferente a dominante | Mostrar advertencia |
| Solo 1-2 prompts en total | No aplicar validación (no hay "patrón") |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ProductManagement.tsx` | Añadir función helper `getSheetInconsistencies()` y mostrar indicadores visuales de advertencia |

## Notas técnicas

- La validación es solo informativa (no bloquea acciones)
- Se basa en el análisis estadístico de las hojas usadas por todos los prompts del producto
- El umbral del 80% evita falsos positivos en productos con prompts distribuidos intencionalmente en varias hojas
- El icono usa el color `text-amber-500` para advertencia (no rojo/error)
- Se añade un `Tooltip` de Radix UI para explicar el problema sin saturar la interfaz

