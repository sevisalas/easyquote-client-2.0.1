
# Corregir nombre del articulo en pedidos

## Problema

En `SalesOrderNew.tsx` y `SalesOrderEdit.tsx`, el campo `product_name` se rellena con `itemDescription` (la descripcion larga con los parametros del producto) en lugar del nombre real (ej. "Encuadernado"). En `QuoteNew.tsx` ya esta bien hecho usando `productName` y `displayName`.

## Cambios

La columna `description` ya existe en `sales_order_items`, asi que no hace falta migracion.

### 1. `SalesOrderNew.tsx` - Tipo ItemSnapshot (lineas 22-32)

Anadir `displayName`, `productName` y `descriptionManual` al tipo:

```typescript
type ItemSnapshot = {
  productId: string;
  prompts: Record<string, any>;
  outputs: any[];
  price?: number;
  displayName?: string;
  productName?: string;
  itemDescription?: string;
  descriptionManual?: boolean;
  itemAdditionals?: any[];
  needsRecalculation?: boolean;
  isFinalized?: boolean;
  compositeData?: any;
};
```

### 2. `SalesOrderNew.tsx` - Guardado de items (lineas 454-456)

Cambiar:
```typescript
// ANTES
product_name: item.itemDescription || "",
description: item.itemDescription || "",

// DESPUES
product_name: item.displayName || item.productName || item.productId || "",
description: item.itemDescription || "",
description_manual: item.descriptionManual || false,
```

### 3. `SalesOrderEdit.tsx` - handleItemChange (linea 202)

Cambiar:
```typescript
// ANTES
product_name: snapshot.itemDescription || updatedItems[itemIndex].product_name,

// DESPUES
product_name: snapshot.displayName || snapshot.productName || updatedItems[itemIndex].product_name,
```

## Impacto

- Pedidos nuevos guardaran el nombre correcto (ej. "Encuadernado") en `product_name` y la descripcion larga en `description`
- Pedidos existentes no cambian automaticamente (habria que re-guardarlos)
- No requiere migracion de base de datos
