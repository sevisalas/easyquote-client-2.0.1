# Memory: style/display-name-over-api-name
Updated: now

REGLA UNIVERSAL: En toda la aplicación, el nombre que se muestra para un artículo/producto es SIEMPRE el "nombre a mostrar" (`name` o `displayName`), NUNCA el nombre técnico del API (`product_name`). El campo `product_name` es interno y solo se usa como referencia técnica. Donde se muestre un artículo al usuario (listas, detalles, PDFs, exportaciones, vistas colapsadas, etc.) debe usarse `item.name` o `item.displayName` como primera opción. El `product_name` solo es fallback de último recurso si `name` está vacío.
