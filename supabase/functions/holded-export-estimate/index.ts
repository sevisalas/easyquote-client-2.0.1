import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

const HOLDED_API_URL = 'https://api.holded.com/api/invoicing/v1/documents/estimate';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { quoteId } = await req.json();
    console.log('Exporting quote to Holded:', quoteId);

    if (!quoteId) {
      throw new Error('quoteId is required');
    }

    // Get quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('user_id', user.id)
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quoteError);
      throw new Error('Quote not found');
    }

    // Get quote items separately
    const { data: quoteItems, error: itemsError } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId);

    if (itemsError) {
      console.error('Error fetching quote items:', itemsError);
      throw new Error('Failed to fetch quote items');
    }

    // Get quote additionals (ajustes sobre el presupuesto)
    const { data: quoteAdditionals, error: additionalsError } = await supabase
      .from('quote_additionals')
      .select('*')
      .eq('quote_id', quoteId);

    if (additionalsError) {
      console.error('Error fetching quote additionals:', additionalsError);
    }

    console.log('📦 Quote items fetched:', JSON.stringify(quoteItems, null, 2));
    console.log('📦 Quote additionals fetched:', JSON.stringify(quoteAdditionals, null, 2));

    // Get Holded contact if customer_id exists
    let contactId = null;
    if (quote.customer_id) {
      const { data: holdedContact } = await supabase
        .from('holded_contacts')
        .select('holded_id')
        .eq('id', quote.customer_id)
        .single();
      
      if (holdedContact?.holded_id) {
        contactId = holdedContact.holded_id;
      }
    }

    if (!contactId) {
      throw new Error('No se encontró contactId de Holded para este cliente');
    }

    // Use API key directly from environment
    const apiKey = '88610992d47b9783e7703c488a8c01cf';
    console.log('Using Holded API key');

    // Build complete payload with all quote data
    const items: any[] = [];
    
    quoteItems.forEach((item: any) => {
      console.log('🔍 Processing item - ALL FIELDS:', JSON.stringify(item, null, 2));
      
      // Check if item has multiple quantities
      const hasMultiQuantities = item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1;
      
      if (hasMultiQuantities) {
        // Create one item per quantity row
        item.multi.rows.forEach((row: any, index: number) => {
          const qtyLabel = `Q${index + 1}`;
          let description = '';
          
          // Build description from prompts
          if (item.prompts && typeof item.prompts === 'object') {
            const promptEntries = Object.entries(item.prompts);
            if (promptEntries.length > 0) {
              description = promptEntries
                .map(([key, promptData]: [string, any]) => {
                  if (promptData && typeof promptData === 'object' && 'label' in promptData && 'value' in promptData) {
                    // For the quantity prompt, use the value from this specific row
                    if (key === item.multi.qtyPrompt && row.qty) {
                      return `${promptData.label}: ${row.qty}`;
                    }
                    return `${promptData.label}: ${promptData.value}`;
                  }
                  return '';
                })
                .filter(Boolean)
                .join('\n');
            }
          }
          
          // Add outputs from the specific row (excluding price fields)
          if (row.outs && Array.isArray(row.outs) && row.outs.length > 0) {
            const outputsText = row.outs
              .filter((out: any) => {
                const name = String(out.name || '').toLowerCase();
                const type = String(out.type || '').toLowerCase();
                return !type.includes('price') && !name.includes('precio') && !name.includes('price');
              })
              .map((out: any) => `${out.name}: ${out.value}`)
              .join('\n');
            
            if (outputsText) {
              description += (description ? '\n' : '') + outputsText;
            }
          }
          
          // Add item additionals (ajustes sobre el artículo) at the end
          if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
            const additionalsText = item.item_additionals
              .map((additional: any) => {
                const value = additional.value || 0;
                const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                return `${additional.name}: ${formattedValue}€`;
              })
              .join('\n');
            
            if (additionalsText) {
              description += (description ? '\n' : '') + additionalsText;
            }
          }
          
          // Get price from this specific row
          const priceOut = (row.outs || []).find((o: any) => 
            String(o?.type || '').toLowerCase() === 'price' ||
            String(o?.name || '').toLowerCase().includes('precio') ||
            String(o?.name || '').toLowerCase().includes('price')
          );
          
          const priceValue = priceOut?.value;
          let price = typeof priceValue === "number" 
            ? priceValue 
            : parseFloat(String(priceValue || 0).replace(/\./g, "").replace(",", ".")) || 0;
          
          // Apply item additionals to the price and calculate discounts
          let discountAmount = 0;
          if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
            item.item_additionals.forEach((additional: any) => {
              const value = additional.value || 0;
              const isDiscount = additional.is_discount || false;
              
              if (isDiscount) {
                // Calculate discount amount but don't apply to price yet
                switch (additional.type) {
                  case 'net_amount':
                    discountAmount += Math.abs(value);
                    break;
                  case 'percentage':
                    discountAmount += Math.abs((price * value) / 100);
                    break;
                }
              } else {
                // Apply non-discount adjustments to price
                switch (additional.type) {
                  case 'net_amount':
                    price += value;
                    break;
                  case 'percentage':
                    price += (price * value) / 100;
                    break;
                  case 'quantity_multiplier':
                    price *= value;
                    break;
                }
              }
            });
          }
          
          // Round to 2 decimals for Holded compatibility
          price = Math.round(price * 100) / 100;
          discountAmount = Math.round(discountAmount * 100) / 100;
          
          const itemData: any = {
            name: `${item.product_name || 'Producto'} (${qtyLabel})`,
            desc: description,
            units: 1,
            subtotal: price,
            taxes: ["s_iva_21"]
          };
          
          // Only add discount if it's greater than 0
          if (discountAmount > 0) {
            itemData.discount = discountAmount;
          }
          
          items.push(itemData);
        });
      } else {
        // Single item without multi quantities
        let description = '';
        
        // Build description from prompts
        if (item.prompts && typeof item.prompts === 'object') {
          const promptEntries = Object.entries(item.prompts);
          if (promptEntries.length > 0) {
            description = promptEntries
              .map(([key, promptData]: [string, any]) => {
                if (promptData && typeof promptData === 'object' && 'label' in promptData && 'value' in promptData) {
                  return `${promptData.label}: ${promptData.value}`;
                }
                return '';
              })
              .filter(Boolean)
              .join('\n');
          }
        }
        
        // Add outputs to description (excluding price fields)
        if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
          const outputsText = item.outputs
            .filter((out: any) => {
              const name = String(out.name || '').toLowerCase();
              const type = String(out.type || '').toLowerCase();
              return !type.includes('price') && !name.includes('precio') && !name.includes('price');
            })
            .map((out: any) => `${out.name}: ${out.value}`)
            .join('\n');
          
          if (outputsText) {
            description += (description ? '\n' : '') + outputsText;
          }
        }
        
        // Add item additionals (ajustes sobre el artículo) at the end
        if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
          const additionalsText = item.item_additionals
            .map((additional: any) => {
              const value = additional.value || 0;
              const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
              return `${additional.name}: ${formattedValue}€`;
            })
            .join('\n');
          
          if (additionalsText) {
            description += (description ? '\n' : '') + additionalsText;
          }
        }
        
        // Get price from outputs or fallback to item.price
        let price = 0;
        if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
          const priceOut = item.outputs.find((o: any) => 
            String(o?.type || '').toLowerCase() === 'price' ||
            String(o?.name || '').toLowerCase().includes('precio') ||
            String(o?.name || '').toLowerCase().includes('price')
          );
          
          if (priceOut) {
            const priceValue = priceOut.value;
            price = typeof priceValue === "number" 
              ? priceValue 
              : parseFloat(String(priceValue || 0).replace(/\./g, "").replace(",", ".")) || 0;
          } else {
            price = parseFloat(item.price) || 0;
          }
        } else {
          price = parseFloat(item.price) || 0;
        }
        
        // Apply item additionals to the price and calculate discounts
        let discountAmount = 0;
        if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
          item.item_additionals.forEach((additional: any) => {
            const value = additional.value || 0;
            const isDiscount = additional.is_discount || false;
            
            if (isDiscount) {
              // Calculate discount amount but don't apply to price yet
              switch (additional.type) {
                case 'net_amount':
                  discountAmount += Math.abs(value);
                  break;
                case 'percentage':
                  discountAmount += Math.abs((price * value) / 100);
                  break;
              }
            } else {
              // Apply non-discount adjustments to price
              switch (additional.type) {
                case 'net_amount':
                  price += value;
                  break;
                case 'percentage':
                  price += (price * value) / 100;
                  break;
                case 'quantity_multiplier':
                  price *= value;
                  break;
              }
            }
          });
        }
        
        // Round price to 2 decimals for Holded compatibility
        price = Math.round(price * 100) / 100;
        discountAmount = Math.round(discountAmount * 100) / 100;
        
        const itemData: any = {
          name: item.product_name || 'Producto',
          desc: description,
          units: 1,
          subtotal: price,
          taxes: ["s_iva_21"]
        };
        
        // Only add discount if it's greater than 0
        if (discountAmount > 0) {
          itemData.discount = discountAmount;
        } else if (item.discount_percentage && parseFloat(item.discount_percentage) > 0) {
          itemData.discount = parseFloat(item.discount_percentage);
        }
        
        items.push(itemData);
      }
    });

    // Add quote additionals (ajustes sobre el presupuesto) as separate items or as distributed discounts
    if (quoteAdditionals && Array.isArray(quoteAdditionals) && quoteAdditionals.length > 0) {
      quoteAdditionals.forEach((additional: any) => {
        const value = additional.value || 0;
        const isDiscount = additional.is_discount || false;
        
        if (!isDiscount) {
          // Calculate price based on type
          let price = 0;
          if (additional.type === 'percentage') {
            // For percentage type, calculate the percentage of the current subtotal
            const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
            price = Math.round((subtotal * value / 100) * 100) / 100;
          } else {
            price = Math.round(parseFloat(String(value)) * 100) / 100;
          }
          
          const itemData: any = {
            name: additional.name || 'Ajuste',
            desc: additional.type === 'percentage' 
              ? `Ajuste ${value}%` 
              : additional.type === 'multiplier'
              ? `Multiplicador x${value}`
              : 'Ajuste sobre el presupuesto',
            units: 1,
            subtotal: price,
            taxes: ["s_iva_21"]
          };
          
          items.push(itemData);
        } else {
          // Distribute discount across all items proportionally
          if (items.length > 0) {
            const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
            let totalDiscountToDistribute = 0;
            
            // Calculate total discount amount
            if (additional.type === 'percentage') {
              totalDiscountToDistribute = (subtotal * Math.abs(value)) / 100;
            } else {
              totalDiscountToDistribute = Math.abs(value);
            }
            
            // Distribute proportionally
            items.forEach((item) => {
              const itemTotal = item.subtotal * item.units;
              const proportion = itemTotal / subtotal;
              const itemDiscount = Math.round((totalDiscountToDistribute * proportion) * 100) / 100;
              item.discount = Math.round(((item.discount || 0) + itemDiscount) * 100) / 100;
            });
          }
        }
      });
    }

    const estimatePayload = {
      docType: 'estimate',
      date: Math.floor(new Date(quote.created_at).getTime() / 1000), // Unix timestamp
      contactId: contactId,
      desc: quote.description || quote.title || '',
      notes: quote.notes || '',
      items: items
    };

    console.log('=== HOLDED EXPORT DEBUG ===');
    console.log('Quote ID:', quoteId);
    console.log('Quote Number:', quote.quote_number);
    console.log('Items count:', items.length);
    console.log('Full payload:', JSON.stringify(estimatePayload, null, 2));
    console.log('API URL:', HOLDED_API_URL);
    console.log('API Key (first 10):', apiKey.substring(0, 10) + '...');
    console.log('=========================');

    // Send to Holded
    const holdedResponse = await fetch(HOLDED_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'key': apiKey
      },
      body: JSON.stringify(estimatePayload)
    });

    const holdedResponseText = await holdedResponse.text();
    console.log('Holded response status:', holdedResponse.status);
    console.log('Holded response:', holdedResponseText);

    if (!holdedResponse.ok) {
      throw new Error(`Holded API error: ${holdedResponse.status} - ${holdedResponseText}`);
    }

    const holdedData = JSON.parse(holdedResponseText);

    // Update quote with Holded estimate ID
    if (holdedData.id) {
      await supabase
        .from('quotes')
        .update({
          holded_estimate_id: holdedData.id,
          holded_estimate_number: holdedData.invoiceNum || null,
          status: 'sent'
        })
        .eq('id', quoteId);

      console.log('Quote updated with Holded estimate ID:', holdedData.id);
      console.log('Quote updated with Holded estimate number:', holdedData.invoiceNum);
    }

    return new Response(
      JSON.stringify({
        success: true,
        estimateId: holdedData.id,
        estimateNumber: holdedData.invoiceNum,
        message: 'Estimate exported to Holded successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in holded-export-estimate:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to export estimate to Holded'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
