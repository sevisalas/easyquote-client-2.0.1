# Panel de taller — más espacio para los procesos

## Objetivo
Ver en pantalla **todos los procesos y su estado** de cada trabajo sin scroll horizontal, dando peso visual a las fases (que hoy son puntitos diminutos).

## Cambios propuestos en `src/pages/ProductionBoard.tsx`

### 1. Compactar columnas de info (recuperar ancho)
Hoy ocupan ~60% del ancho. Las fusionamos en 2 columnas estrechas:

- **Trabajo** (una sola columna apilada):
  - Línea 1: `Nº pedido` (link) · cantidad pequeña a la derecha
  - Línea 2: Cliente en `text-xs text-muted-foreground`
  - Línea 3: Artículo en `text-xs` truncado
- **Fechas** (una sola columna estrecha):
  - Línea 1: Entrega (destacada)
  - Línea 2: Pedido en `text-xs text-muted-foreground`
- Eliminar columnas separadas de Fecha, Entrega, Cliente, Artículo, Cantidad.
- Mantener columna **Estado** como badge compacto.

### 2. Dar protagonismo a las fases
- Cada fase pasa de `w-3` (punto) a una **celda tipo "chip"** de ~80–100px con:
  - Color de la fase como fondo según estado
  - Nombre corto de la fase
  - Icono/letra de estado (✓ completada, ● en curso pulsante, ‖ pausada, ○ pendiente, vacío si no aplica)
- Header de fase con nombre completo y color en barra superior fina.
- Las celdas de fase usan `min-w-[90px]` para que se lean.

### 3. Aprovechar el ancho de pantalla
- Reducir padding del contenedor (`p-4 md:p-8` → `p-3 md:p-4`).
- Quitar `Card` envoltorio de la tabla o usar `border-0` para ganar ~32px.
- Tabla en `table-fixed` con anchos controlados: Fechas 90px, Trabajo 280px, Estado 110px, resto repartido entre fases.
- Si hay muchas fases (>8), permitir scroll horizontal **solo** en la zona de fases manteniendo las columnas de info fijas (`sticky left-0`).

### 4. Densidad de fila
- `py-2` por celda, alto de fila consistente ~52px (caben las 2–3 líneas del bloque Trabajo).
- Hover row sutil.

## Resultado esperado
En un viewport de 1784px caben cómodamente ~10–12 fases visibles con nombre legible, y la info de pedido/cliente/artículo sigue completa pero en menos espacio.

## Fuera de alcance
- No tocar lógica de carga, RLS, ni cálculo de estados de fase.
- No tocar vistas Compacta ni Tablero.
- Solo cambios de presentación en `ProductionBoard.tsx`.

¿Apruebas o quieres ajustar algo (p. ej. mantener columna Cliente separada, o no usar sticky)?
