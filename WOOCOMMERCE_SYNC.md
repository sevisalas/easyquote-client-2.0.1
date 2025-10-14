# WooCommerce Product Sync - Documentación

## Resumen

Esta funcionalidad permite sincronizar automáticamente los productos vinculados de WooCommerce con EasyQuote.

## Endpoint de Sincronización

**URL:** `https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/sync-woocommerce-products`

**Método:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "api_key": "YOUR_ORGANIZATION_API_KEY",
  "products": [
    {
      "calculator_id": "12da815a-1d42-48fb-860f-621a4c23fe3a",
      "product_name": "Acreditaciones",
      "woo_products": [
        {
          "id": 17839,
          "name": "Acreditacion Personalizada",
          "slug": "acreditacion-personalizada",
          "permalink": "https://m50.es/producto/acreditacion-personalizada/",
          "image": "https://m50.es/wp-content/uploads/2024/04/Acreditacion-Personalizada.jpg",
          "calculator_id": "12da815a-1d42-48fb-860f-621a4c23fe3a",
          "calculator_disabled": ""
        }
      ]
    }
  ]
}
```

## Formato de Respuesta

### Éxito
```json
{
  "success": true,
  "synced": 132,
  "message": "Successfully synced 132 products"
}
```

### Error
```json
{
  "error": "Invalid API key"
}
```

## Obtener API Key

1. El usuario debe ir a la configuración de su organización en EasyQuote
2. Generar una API Key en la sección de credenciales
3. Usar esa API Key en las llamadas al endpoint

## Implementación en WordPress Plugin

El plugin de WordPress debe:

1. **Obtener todos los calculators de EasyQuote activos**
2. **Para cada calculator, consultar los productos vinculados en WooCommerce**
3. **Enviar todos los datos en un solo POST al endpoint de sync**

### Ejemplo de implementación PHP:

```php
<?php
function sync_woocommerce_products_to_easyquote() {
    $api_key = get_option('easyquote_api_key');
    $calculators = get_all_easyquote_calculators(); // Tu función existente
    
    $products = [];
    
    foreach ($calculators as $calculator) {
        $calculator_id = $calculator['id'];
        $woo_products = get_products_by_calculator($calculator_id); // Tu función existente
        
        $products[] = [
            'calculator_id' => $calculator_id,
            'product_name' => $calculator['name'],
            'woo_products' => $woo_products
        ];
    }
    
    // Enviar a EasyQuote
    $response = wp_remote_post('https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/sync-woocommerce-products', [
        'headers' => [
            'Content-Type' => 'application/json',
        ],
        'body' => json_encode([
            'api_key' => $api_key,
            'products' => $products
        ]),
        'timeout' => 30
    ]);
    
    if (is_wp_error($response)) {
        error_log('EasyQuote sync error: ' . $response->get_error_message());
        return false;
    }
    
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    if (isset($body['success']) && $body['success']) {
        return true;
    }
    
    return false;
}

// Llamar esta función cuando se necesite sincronizar
// Por ejemplo, después de guardar un producto o mediante un cron job
add_action('save_post_product', 'sync_woocommerce_products_to_easyquote');
```

## Notas Importantes

- La sincronización se hace por organización usando la API Key
- Los productos se identifican por `calculator_id` (que es el ID del producto en EasyQuote)
- Si un producto ya existe en la base de datos, se actualiza
- Si un producto no existe, se crea
- La respuesta incluye el número de productos sincronizados

## Flujo Completo

1. **WordPress Plugin:**
   - Obtiene todos los calculators activos de EasyQuote
   - Para cada calculator, consulta los productos de WooCommerce vinculados
   - Envía todo en un solo POST al endpoint de sync

2. **EasyQuote Backend:**
   - Valida la API Key
   - Identifica la organización
   - Guarda/actualiza los vínculos en la tabla `woocommerce_product_links`

3. **EasyQuote Frontend:**
   - Lee los vínculos directamente desde la tabla
   - Muestra el estado de vinculación en la interfaz
   - Genera reportes CSV con los datos sincronizados
