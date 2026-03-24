

## Plan: Identificar archivos maestros en la APP

### Contexto
La tabla `excel_files` ya tiene el campo `is_master` y el código ya lo lee (`isMaster`), pero **no hay UI para marcarlo ni se muestra visualmente** en la tabla de archivos. Solo se cuenta en `ApiHome.tsx`.

### Cambios (solo visibles para org Tradsis: `f95d535e-...`)

#### 1. Mostrar badge "Maestro" en la tabla de archivos
En `ExcelFiles.tsx`, junto al nombre del archivo, mostrar un badge con icono `Crown` cuando `isMaster === true`.

#### 2. Añadir botón para marcar/desmarcar como maestro
En la columna de acciones de cada fila, añadir un botón con icono `Crown` que toggle el campo `is_master` en la tabla `excel_files` de Supabase. Solo visible si la org activa es Tradsis.

#### 3. Añadir campo `local_reference_name` a la tabla `excel_files`
Migración para añadir columna `local_reference_name TEXT` (nullable). Este es el nombre que se usa en las fórmulas locales de Excel (ej: `maestro.xlsx`) para que luego el sistema pueda hacer el reemplazo.

#### 4. Al marcar como maestro, pedir el nombre de referencia local
Cuando el usuario activa "maestro", mostrar un input para introducir el `local_reference_name` (ej: `maestro.xlsx`).

#### 5. Separar visualmente maestros de productos en la tabla
Ordenar la lista poniendo los maestros arriba con un separador visual, o añadir un filtro/tab "Maestros" / "Productos".

### Detalle técnico
- **Gating por org**: `organization?.id === 'f95d535e-5a8f-4fef-9dda-75071d5b0e9e'`
- **Mutación**: `supabase.from('excel_files').update({ is_master, local_reference_name }).eq('file_id', fileId).eq('user_id', userId)`
- **Migración**: `ALTER TABLE excel_files ADD COLUMN IF NOT EXISTS local_reference_name TEXT;`
- **UI badge**: `{file.isMaster && <Badge variant="outline" className="..."><Crown className="h-3 w-3" /> Maestro</Badge>}`

