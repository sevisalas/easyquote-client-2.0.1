

# Plan: Persistir datos de componentes compuestos en JSONB

## Problema

Cuando se guarda un presupuesto con un producto compuesto (ej: Encuadernado con Cubierta + Interior), los datos de los componentes individuales (prompts, outputs, precio de cada componente) **no se persisten**. Al recargar el presupuesto, solo se recuperan los datos del producto padre, perdiendo toda la configuracion de componentes.

## Solucion

Guardar `compositeComponentsData` y `activeCompositeComponents` dentro del snapshot que `QuoteItem` envia al padre, y persistirlos en un nuevo campo JSONB `composite_data` en las tablas `quote_items` y `sales_order_items`.

## Cambios

### 1. Migracion de base de datos

Anadir columna `composite_data JSONB` a ambas tablas:

```sql
ALTER TABLE quote_items ADD COLUMN composite_data jsonb;
ALTER TABLE sales_order_items ADD COLUMN composite_data jsonb;
```

La columna almacenara un objeto con esta estructura:

```text
{
  "components": {            -- ComponentsDataMap serializado
    "componentId:1": {
      "prompts": [...],
      "outputs": [...],
      "price": 123.45,
      "alias": "Cubierta"
    },
    ...
  },
  "activeComponents": [...], -- ActiveComponent[] serializado
  "totalPrice": 456.78,
  "parentOutputs": [...]
}
```

### 2. QuoteItem.tsx - syncToParent

Anadir al snapshot los datos compuestos:

- `compositeData`: objeto con `components`, `activeComponents`, `totalPrice`, `parentOutputs`
- Solo se incluye si el producto tiene componentes configurados (`hasConfiguredComponents`)

### 3. QuoteNew.tsx - Guardar composite_data

En la funcion de guardado, incluir `composite_data` del snapshot al insertar en `quote_items`.

### 4. QuoteEdit.tsx - Guardar y cargar composite_data

- **Guardar**: Incluir `composite_data` en el insert de items
- **Cargar**: Leer `composite_data` del item de la BD y pasarlo como parte del `initialData` al QuoteItem

### 5. QuoteItem.tsx - Restaurar estado compuesto desde initialData

Al inicializar, si `initialData.compositeData` existe:

- Restaurar `activeCompositeComponents` desde `compositeData.activeComponents`
- Restaurar `compositeComponentsData` desde `compositeData.components`
- Restaurar `compositeTotalPrice` y `compositeParentOutputs`

Esto permite que al abrir un presupuesto guardado, los componentes se muestren con sus datos sin necesidad de recalcular desde la API.

### 6. SalesOrderNew/SalesOrderEdit (si aplica)

Aplicar la misma logica de guardado/carga para pedidos, ya que comparten la misma estructura.

## Secuencia

```text
1. Migracion DB (composite_data column)
2. QuoteItem syncToParent (incluir compositeData)
3. QuoteNew/QuoteEdit guardado (persistir composite_data)
4. QuoteEdit carga (leer composite_data y pasar a initialData)
5. QuoteItem init (restaurar estado desde initialData.compositeData)
6. Repetir para SalesOrder si aplica
```

## Riesgos y mitigaciones

- **Riesgo**: Los datos guardados pueden quedar desactualizados si se modifican los productos. **Mitigacion**: El comportamiento actual ya es asi con prompts/outputs -- los datos guardados son definitivos.
- **Riesgo**: Tamano del JSONB. **Mitigacion**: Los datos de componentes son pequenos (prompts + outputs + precio por componente), similar a lo que ya se guarda en `prompts` y `outputs`.
- **Sin regresiones**: No se modifica la logica de calculo ni de recalculacion; solo se anade persistencia.

