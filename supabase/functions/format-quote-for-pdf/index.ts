import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromptDef {
  id: string;
  name: string;
  type: string;
  options?: any[];
}

function extractPrompts(product: any): PromptDef[] {
  const prompts: PromptDef[] = [];
  
  if (!product) return prompts;

  // Extract from product.prompts array
  if (Array.isArray(product.prompts)) {
    product.prompts.forEach((p: any) => {
      prompts.push({
        id: p.id || p._id || '',
        name: p.name || p.label || '',
        type: p.type || 'text',
        options: p.options
      });
    });
  }

  // Extract from product.data
  if (product.data) {
    Object.keys(product.data).forEach(key => {
      const val = product.data[key];
      if (val && typeof val === 'object') {
        if (val.type === 'prompt' || val.promptType) {
          prompts.push({
            id: val.id || val._id || key,
            name: val.name || val.label || key,
            type: val.promptType || val.type || 'text',
            options: val.options
          });
        }
      }
    });
  }

  // Extract from product.parameters
  if (Array.isArray(product.parameters)) {
    product.parameters.forEach((p: any) => {
      prompts.push({
        id: p.id || p._id || '',
        name: p.name || p.label || '',
        type: p.type || 'text',
        options: p.options
      });
    });
  }

  return prompts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quote_id } = await req.json();

    if (!quote_id) {
      throw new Error('quote_id is required');
    }

    console.log('Fetching quote:', quote_id);

    // Fetch quote with items and customer
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers(*),
        items:quote_items(*),
        quote_additionals(*)`
      )
      .eq('id', quote_id)
      .single();

    if (quoteError) throw quoteError;
    if (!quote) throw new Error('Quote not found');

    console.log('Quote fetched, processing items:', quote.items?.length);

    // Get user credentials for EasyQuote API
    const { data: credentials } = await supabase
      .rpc('get_user_credentials', { p_user_id: quote.user_id });

    const userCredentials = credentials?.[0];
    let apiToken = null;

    if (userCredentials?.api_username && userCredentials?.api_password) {
      // Get EasyQuote token
      const authResponse = await supabase.functions.invoke('easyquote-auth', {
        body: {
          username: userCredentials.api_username,
          password: userCredentials.api_password
        }
      });

      if (authResponse.data?.token) {
        apiToken = authResponse.data.token;
      }
    }

    // Process items from quote_items table
    const processedItems = [];

    if (quote.items && Array.isArray(quote.items)) {
      for (const item of quote.items) {
        const processedItem: any = {
          id: item.id,
          name: item.name || item.product_name,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          total_price: item.total_price,
          outputs: item.outputs || [],
          prompts: [],
          item_additionals: item.item_additionals || []
        };

        // If has product_id and token, fetch product to get prompt names
        if (item.product_id && apiToken) {
          try {
            console.log('Fetching product:', item.product_id);
            
            const productsResponse = await supabase.functions.invoke('easyquote-products', {
              body: { token: apiToken, includeInactive: false }
            });

            if (productsResponse.data?.products) {
              const product = productsResponse.data.products.find(
                (p: any) => p.id === item.product_id || p._id === item.product_id
              );

              if (product) {
                const promptDefs = extractPrompts(product);
                console.log('Found prompt definitions:', promptDefs.length);

                // Transform prompts from {id: value} to {name, value, type}
                const itemPrompts = item.prompts || {};
                processedItem.prompts = Object.entries(itemPrompts).map(([promptId, value]) => {
                  const promptDef = promptDefs.find(p => p.id === promptId);
                  return {
                    id: promptId,
                    name: promptDef?.name || promptId,
                    type: promptDef?.type || 'text',
                    value: value
                  };
                });
              }
            }
          } catch (error) {
            console.error('Error fetching product:', error);
            // Keep original prompts if fetch fails
            processedItem.prompts = Object.entries(item.prompts || {}).map(([id, value]) => ({
              id,
              name: id,
              type: 'text',
              value
            }));
          }
        } else {
          // No product_id or no token, just use IDs as names
          processedItem.prompts = Object.entries(item.prompts || {}).map(([id, value]) => ({
            id,
            name: id,
            type: 'text',
            value
          }));
        }

        processedItems.push(processedItem);
      }
    }

    // Process items from selections JSON (legacy)
    if (quote.selections && Array.isArray(quote.selections)) {
      for (const selection of quote.selections) {
        const processedItem: any = {
          name: selection.productName || selection.itemDescription || 'Producto',
          product_name: selection.productName,
          description: selection.itemDescription || selection.description,
          quantity: selection.quantity || 1,
          total_price: selection.price || 0,
          outputs: selection.outputs || [],
          prompts: [],
          item_additionals: selection.itemAdditionals || []
        };

        // If has productId and token, fetch product
        if (selection.productId && apiToken) {
          try {
            const productsResponse = await supabase.functions.invoke('easyquote-products', {
              body: { token: apiToken, includeInactive: false }
            });

            if (productsResponse.data?.products) {
              const product = productsResponse.data.products.find(
                (p: any) => p.id === selection.productId || p._id === selection.productId
              );

              if (product) {
                const promptDefs = extractPrompts(product);
                const itemPrompts = selection.prompts || {};
                processedItem.prompts = Object.entries(itemPrompts).map(([promptId, value]) => {
                  const promptDef = promptDefs.find(p => p.id === promptId);
                  return {
                    id: promptId,
                    name: promptDef?.name || promptId,
                    type: promptDef?.type || 'text',
                    value: value
                  };
                });
              }
            }
          } catch (error) {
            console.error('Error fetching product for selection:', error);
            processedItem.prompts = Object.entries(selection.prompts || {}).map(([id, value]) => ({
              id,
              name: id,
              type: 'text',
              value
            }));
          }
        } else {
          processedItem.prompts = Object.entries(selection.prompts || {}).map(([id, value]) => ({
            id,
            name: id,
            type: 'text',
            value
          }));
        }

        processedItems.push(processedItem);
      }
    }

    // Build final JSON
    const formattedQuote = {
      id: quote.id,
      quote_number: quote.quote_number,
      title: quote.title,
      description: quote.description,
      status: quote.status,
      created_at: quote.created_at,
      valid_until: quote.valid_until,
      customer: quote.customer ? {
        id: quote.customer.id,
        name: quote.customer.name,
        email: quote.customer.email,
        phone: quote.customer.phone,
        address: quote.customer.address
      } : null,
      items: processedItems,
      quote_additionals: quote.quote_additionals || [],
      subtotal: quote.subtotal,
      discount_amount: quote.discount_amount,
      tax_amount: quote.tax_amount,
      final_price: quote.final_price,
      notes: quote.notes,
      terms_conditions: quote.terms_conditions
    };

    console.log('Quote formatted successfully');

    return new Response(
      JSON.stringify(formattedQuote),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in format-quote-for-pdf:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
