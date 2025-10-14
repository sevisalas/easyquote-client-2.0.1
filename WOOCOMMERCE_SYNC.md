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
  "woo_products": [
    {
      "id": 17839,
      "name": "Acreditacion Personalizada",
      "slug": "acreditacion-personalizada",
      "permalink": "https://m50.es/producto/acreditacion-personalizada/",
      "image": "https://m50.es/wp-content/uploads/2024/04/Acreditacion-Personalizada.jpg",
      "calculator_id": "12da815a-1d42-48fb-860f-621a4c23fe3a",
      "calculator_disabled": ""
    },
    {
      "id": 17840,
      "name": "Otro Producto",
      "slug": "otro-producto",
      "permalink": "https://m50.es/producto/otro-producto/",
      "calculator_id": "255443e6-34ab-45a5-8045-ba609c58cfbc"
    }
  ]
}
```

**Importante:** Cada producto de WooCommerce DEBE incluir el campo `calculator_id` que es el ID del producto de EasyQuote al que está vinculado.

## Formato de Respuesta

### Éxito
```json
{
  "success": true,
  "synced_calculators": 45,
  "synced_woo_products": 132,
  "message": "Successfully synced 45 linked calculators with 132 WooCommerce products"
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

1. **Obtener TODOS los productos de WooCommerce que tengan el campo personalizado `calculator_id`**
2. **Enviar todos esos productos en un solo POST al endpoint de sync**

### Ejemplo de implementación PHP:

```php
<?php
function sync_woocommerce_products_to_easyquote() {
    $api_key = get_option('easyquote_api_key');
    
    // Obtener TODOS los productos de WooCommerce que tengan calculator_id
    $args = [
        'post_type' => 'product',
        'posts_per_page' => -1,
        'meta_query' => [
            [
                'key' => 'calculator_id', // o el meta_key que uses para el ID de EasyQuote
                'compare' => 'EXISTS'
            ]
        ]
    ];
    
    $products = get_posts($args);
    $woo_products = [];
    
    foreach ($products as $product) {
        $product_obj = wc_get_product($product->ID);
        $calculator_id = get_post_meta($product->ID, 'calculator_id', true);
        
        if (empty($calculator_id)) {
            continue;
        }
        
        $woo_products[] = [
            'id' => $product->ID,
            'name' => $product_obj->get_name(),
            'slug' => $product_obj->get_slug(),
            'permalink' => get_permalink($product->ID),
            'image' => wp_get_attachment_url($product_obj->get_image_id()),
            'calculator_id' => $calculator_id,
            'calculator_disabled' => get_post_meta($product->ID, 'calculator_disabled', true) ?: ''
        ];
    }
    
    // Enviar a EasyQuote
    $response = wp_remote_post('https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/sync-woocommerce-products', [
        'headers' => [
            'Content-Type' => 'application/json',
        ],
        'body' => json_encode([
            'api_key' => $api_key,
            'woo_products' => $woo_products
        ]),
        'timeout' => 30
    ]);
    
    if (is_wp_error($response)) {
        error_log('EasyQuote sync error: ' . $response->get_error_message());
        return false;
    }
    
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    if (isset($body['success']) && $body['success']) {
        error_log("EasyQuote sync success: {$body['synced_calculators']} calculators, {$body['synced_woo_products']} products");
        return true;
    }
    
    return false;
}

// Llamar esta función cuando se necesite sincronizar
// Por ejemplo, después de guardar un producto o mediante un cron job
add_action('save_post_product', 'sync_woocommerce_products_to_easyquote');

// O mediante un cron job cada hora
add_action('easyquote_hourly_sync', 'sync_woocommerce_products_to_easyquote');
```

## Notas Importantes

- La sincronización se hace por organización usando la API Key
- WordPress envía SOLO los productos de WooCommerce que tienen un `calculator_id`
- El campo `calculator_id` en cada producto de WooCommerce es el ID del producto de EasyQuote
- Cada sincronización REEMPLAZA todos los vínculos anteriores (no es incremental)
- EasyQuote cruza estos vínculos con todos sus productos para mostrar el estado completo

## Flujo Completo

1. **WordPress Plugin:**
   - Obtiene TODOS los productos de WooCommerce que tengan el campo `calculator_id`
   - Envía esos productos en un array al endpoint de sync
   - Cada producto de WooCommerce incluye su `calculator_id` que lo vincula con EasyQuote

2. **EasyQuote Backend:**
   - Valida la API Key
   - Identifica la organización
   - Limpia todos los vínculos anteriores de esa organización
   - Agrupa los productos de WooCommerce por `calculator_id`
   - Guarda los nuevos vínculos en la tabla `woocommerce_product_links`

3. **EasyQuote Frontend:**
   - Consulta todos los productos de EasyQuote
   - Lee los vínculos desde la tabla `woocommerce_product_links`
   - Cruza ambas fuentes para mostrar qué productos están vinculados
   - Genera reportes CSV con los datos sincronizados

## Ventajas de este Enfoque

- **Sin problemas de CORS:** WordPress hace un POST directo, no hay llamadas desde el navegador
- **Sin bloqueos de firewall:** WordPress hace la petición desde su servidor, no desde Supabase
- **Datos siempre actualizados:** WordPress controla cuándo sincronizar
- **Escalable:** No importa cuántos productos haya, se envía todo de una vez
