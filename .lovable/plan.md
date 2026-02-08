
# Plan: Layout vertical de 2 columnas para opciones restrictivas en productos compuestos

## Problema

Las "Opciones restrictivas" dentro de productos compuestos usan un layout inline de 3 columnas que resulta muy apretado e ilegible, especialmente con etiquetas largas como "Forzar poses/pags.".

## Solución

Cambiar **solo** las opciones restrictivas de componentes dentro de productos compuestos a:
- **2 columnas** (en lugar de 3)
- **Layout vertical** (etiqueta arriba del campo, no al lado)

## Cambios en CompositeComponentTabs.tsx

### 1. Opciones restrictivas del padre (línea 1374)

**Antes:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
  <div className="flex items-center gap-2 py-1">
    <span className="text-sm">{prompt.label}</span>
    <Select ... className="h-8 w-auto min-w-[100px]">
```

**Después:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-1">
    <Label className="text-sm">{prompt.label}</Label>
    <Select ... className="w-full">
```

### 2. Opciones restrictivas del componente (línea 1512)

Aplicar el mismo cambio de layout.

## Detalle de cada tipo de campo

| Tipo | Antes | Después |
|------|-------|---------|
| **Select** | `flex items-center gap-2`, `w-auto min-w-[100px]` | `space-y-1`, `w-full` |
| **Input** | `flex items-center gap-2`, `w-24` | `space-y-1`, `w-full` |
| **Checkbox** | `flex items-center gap-2` | Mantener inline (es más compacto) |

## Resultado visual esperado

```text
┌─────────────────────────┐  ┌─────────────────────────┐
│ Forzar recurso          │  │ Forzar poses/pags.      │
│ [No                  ▾] │  │ [1                   ▾] │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│ Ancho máximo            │  │ [✓] Usar margen extra   │
│ [_________________]     │  │                         │
└─────────────────────────┘  └─────────────────────────┘
```

## Archivos a modificar

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `src/components/quotes/CompositeComponentTabs.tsx` | 1374-1446 | Layout vertical 2 columnas para opciones restrictivas del padre |
| `src/components/quotes/CompositeComponentTabs.tsx` | 1512-1594 | Layout vertical 2 columnas para opciones restrictivas del componente |

## Notas técnicas

- Solo afecta a productos compuestos (CompositeComponentTabs)
- Los productos simples (PromptsForm) mantienen su layout actual de 3 columnas
- Los checkboxes mantienen layout horizontal porque son más compactos
- Se usa el componente `Label` existente para consistencia visual
