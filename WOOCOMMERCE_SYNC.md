# WooCommerce Product Sync Documentation

## Overview
This document describes the integration between the WordPress WooCommerce plugin and the EasyQuote product catalog system.

## Authentication
You need to generate an API Key from your EasyQuote organization settings. This API key must be included in all requests to authenticate with the system.

### How to Get Your API Key
1. Log in to EasyQuote
2. Go to Settings → Integrations
3. Generate an API Key for WooCommerce
4. Copy the generated key

## Endpoint
**URL:** `https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/sync-woocommerce-products`

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY_HERE
```

## Request Format

The WordPress plugin should send an array of WooCommerce products that have a `calculator_id` assigned.

### Request Body Structure
```json
{
  "products": [
    {
      "id": 123,
      "name": "Product Name",
      "calculator_id": "cab31314-bf2f-4a4b-b38b-b3b0938b71c0"
    },
    {
      "id": 456,
      "name": "Another Product",
      "calculator_id": "another-calculator-id"
    }
  ]
}
```

### Field Descriptions
- **id** (integer, required): The WooCommerce product ID
- **name** (string, required): The WooCommerce product name
- **calculator_id** (string, required): The associated EasyQuote calculator/product ID

**Important:** Each WooCommerce product MUST include the `calculator_id` field which is the ID of the EasyQuote product it links to.

## Response Format

### Success Response
```json
{
  "success": true,
  "synced": 5,
  "message": "Successfully synced 5 products"
}
```

### Error Response
```json
{
  "error": "Error message description",
  "details": "Additional error details if available"
}
```

Common errors:
- **401 Unauthorized**: Invalid or missing API key
- **400 Bad Request**: Invalid request format or missing required fields
- **500 Internal Server Error**: Server-side processing error

## WordPress Plugin Implementation

The plugin should:

1. **Query WooCommerce products** that have the `calculator_id` meta field set
2. **Filter products** to only include those with valid calculator_id values
3. **Format the data** according to the request structure above
4. **Send the request** with proper authentication headers
5. **Handle the response** and display appropriate messages to the admin

### Example PHP Implementation
```php
function sync_woocommerce_products_to_easyquote() {
    $api_key = get_option('easyquote_api_key'); // Store API key in WordPress options
    
    if (empty($api_key)) {
        return array('error' => 'API key not configured');
    }
    
    // Get all products with calculator_id
    $args = array(
        'post_type' => 'product',
        'posts_per_page' => -1,
        'meta_query' => array(
            array(
                'key' => 'calculator_id',
                'compare' => 'EXISTS'
            )
        )
    );
    
    $products = get_posts($args);
    $products_data = array();
    
    foreach ($products as $product) {
        $calculator_id = get_post_meta($product->ID, 'calculator_id', true);
        
        if (!empty($calculator_id)) {
            $products_data[] = array(
                'id' => $product->ID,
                'name' => $product->post_title,
                'calculator_id' => $calculator_id
            );
        }
    }
    
    // Send to API
    $response = wp_remote_post('https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/sync-woocommerce-products', array(
        'headers' => array(
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $api_key
        ),
        'body' => json_encode(array('products' => $products_data)),
        'timeout' => 30
    ));
    
    if (is_wp_error($response)) {
        error_log('EasyQuote sync error: ' . $response->get_error_message());
        return array('error' => $response->get_error_message());
    }
    
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    if (isset($body['success']) && $body['success']) {
        error_log("EasyQuote sync success: {$body['synced']} products synced");
    }
    
    return $body;
}

// Trigger sync after saving a product
add_action('save_post_product', 'sync_woocommerce_products_to_easyquote');

// Or use a cron job for periodic sync
add_action('easyquote_hourly_sync', 'sync_woocommerce_products_to_easyquote');
```

## System Behavior

Once the WordPress plugin sends the product data:

1. The system validates the API key and identifies the organization
2. It clears all previous product links for that organization
3. It processes each product in the array
4. It groups WooCommerce products by their `calculator_id`
5. It creates or updates the product mappings in the database
6. It returns a summary of the sync operation

**Important:** 
- The plugin only needs to send products that have a `calculator_id` assigned
- Each sync REPLACES all previous links (it's not incremental)
- The EasyQuote system handles all the backend processing, validation, and storage automatically

## Complete Flow

1. **WordPress Plugin:**
   - Gets ALL WooCommerce products that have the `calculator_id` field
   - Sends those products in an array to the sync endpoint
   - Each WooCommerce product includes its `calculator_id` that links it to EasyQuote

2. **EasyQuote Backend:**
   - Validates the API Key
   - Identifies the organization
   - Clears all previous links for that organization
   - Groups WooCommerce products by `calculator_id`
   - Saves the new links in the `woocommerce_product_links` table

3. **EasyQuote Frontend:**
   - Queries all EasyQuote products
   - Reads the links from the `woocommerce_product_links` table
   - Cross-references both sources to show which products are linked
   - Generates CSV reports with the synchronized data

## Advantages of This Approach

- **No CORS issues:** WordPress makes a direct POST, no browser calls
- **No firewall blocks:** WordPress makes the request from its server, not from Supabase
- **Always up-to-date data:** WordPress controls when to sync
- **Scalable:** No matter how many products, everything is sent at once

## Testing

To test the integration:

1. Configure the API key in the WordPress plugin
2. Ensure at least one WooCommerce product has a `calculator_id` meta field
3. Trigger the sync from the WordPress admin panel
4. Check the response for success/error messages
5. Verify the products appear in the EasyQuote system under Product Management

## Support

For issues or questions about the integration:
- Check the WordPress plugin logs
- Verify the API key is correct
- Ensure the `calculator_id` values match actual EasyQuote product IDs
- Contact the development team if problems persist
