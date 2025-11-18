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
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quoteError);
      throw new Error('Quote not found');
    }

    // Verify user has access to this quote (either owns it or is in the same organization)
    if (quote.user_id !== user.id) {
      // Check if both users are in the same organization
      const { data: userOrg } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      const { data: quoteOwnerOrg } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', quote.user_id)
        .single();

      if (!userOrg || !quoteOwnerOrg || userOrg.organization_id !== quoteOwnerOrg.organization_id) {
        throw new Error('No tienes permiso para exportar este presupuesto');
      }
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

    // Get quote additionals from the quote's JSON field (not from separate table)
    const quoteAdditionals = quote.quote_additionals || [];

    console.log('📦 Quote items fetched:', JSON.stringify(quoteItems, null, 2));
    console.log('📦 Quote additionals from quote JSON:', JSON.stringify(quoteAdditionals, null, 2));

    // Get customer holded_id if customer_id exists
    let contactId: string | null = null;
    
    if (quote.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('holded_id')
        .eq('id', quote.customer_id)
        .maybeSingle();
      
      if (customer?.holded_id) {
        contactId = customer.holded_id;
      }
    }

    if (!contactId) {
      throw new Error('No se encontró contactId de Holded para este cliente');
    }

    // Get the sales account (cuenta_holded) from the quote creator
    let salesChannelId = null;
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('cuenta_holded')
      .eq('user_id', quote.user_id)
      .maybeSingle();
    
    if (memberData?.cuenta_holded) {
      salesChannelId = memberData.cuenta_holded;
      console.log('Using sales account:', salesChannelId);
    }

    // Use API key directly from environment
    const apiKey = '88610992d47b9783e7703c488a8c01cf';
    console.log('Using Holded API key');

    // Get EasyQuote credentials to fetch product definitions
    const { data: easyquoteCredsData } = await supabase
      .rpc('get_organization_easyquote_credentials', { p_user_id: user.id });
    
    const easyquoteCreds = easyquoteCredsData?.[0];
    if (!easyquoteCreds) {
      console.warn('No EasyQuote credentials found, proceeding without visibility filtering');
    }

    // Get EasyQuote token for fetching product definitions
    let easyquoteToken: string | null = null;
    if (easyquoteCreds) {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('easyquote-auth', {
        body: {
          email: easyquoteCreds.api_username,
          password: easyquoteCreds.api_password
        }
      });
      
      if (!tokenError && tokenData?.token) {
        easyquoteToken = tokenData.token;
        console.log('✅ Got EasyQuote token for product definitions');
      } else {
        console.warn('Failed to get EasyQuote token:', tokenError);
      }
    }

    // Get unique product IDs and fetch their definitions
    const productDefinitions: Record<string, any> = {};
    if (easyquoteToken) {
      const uniqueProductIds = [...new Set(quoteItems.map((item: any) => item.product_id).filter(Boolean))];
      
      for (const productId of uniqueProductIds) {
        try {
          // Get the product to find its excelFileId
          const { data: productData } = await supabase
            .from('products')
            .select('excelfileId, name')
            .eq('product_id', productId)
            .single();

          if (productData?.excelfileId) {
            // Get Excel file info
            const { data: excelFile } = await supabase
              .from('excel_files')
              .select('file_id, filename')
              .eq('file_id', productData.excelfileId)
              .single();

            if (excelFile) {
              // Decode token to get subscriberId
              const tokenParts = easyquoteToken.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                const subscriberId = payload.SubscriberID;

                // Fetch product definition
                const { data: masterFileData, error: masterFileError } = await supabase.functions.invoke('easyquote-master-files', {
                  body: {
                    token: easyquoteToken,
                    subscriberId,
                    fileId: excelFile.file_id,
                    fileName: excelFile.filename,
                    productId
                  }
                });

                if (!masterFileError && masterFileData?.product) {
                  productDefinitions[productId] = masterFileData.product;
                  console.log(`✅ Loaded definition for product ${productId}`);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to load definition for product ${productId}:`, error);
        }
      }
    }

    // Helper function to check if prompt is visible based on product definition
    const isPromptVisible = (promptId: string, promptValue: any, allPrompts: Record<string, any>, productId: string): boolean => {
      const productDef = productDefinitions[productId];
      if (!productDef || !productDef.prompts) {
        // If no product definition, show all prompts (fallback to safe behavior)
        return true;
      }

      // Find prompt definition
      const promptDef = productDef.prompts.find((p: any) => p.id === promptId);
      if (!promptDef) return true; // If not found in definition, show it
      
      // Build values object for evaluation
      const values: Record<string, any> = {};
      Object.entries(allPrompts).forEach(([id, data]: [string, any]) => {
        values[id] = data.value;
      });
      
      // Check hiddenWhen condition
      if (promptDef.hiddenWhen) {
        if (typeof promptDef.hiddenWhen === 'object') {
          const field = promptDef.hiddenWhen.field || promptDef.hiddenWhen.id;
          const expectedValue = promptDef.hiddenWhen.equals || promptDef.hiddenWhen.value;
          if (field && values[field] !== undefined) {
            if (String(values[field]) === String(expectedValue)) {
              return false; // Hidden when condition is met
            }
          }
        }
      }
      
      // Check visibility condition
      if (promptDef.visibility) {
        if (typeof promptDef.visibility === 'object') {
          const field = promptDef.visibility.field || promptDef.visibility.id;
          const expectedValue = promptDef.visibility.equals || promptDef.visibility.value;
          if (field && values[field] !== undefined) {
            if (String(values[field]) !== String(expectedValue)) {
              return false; // Not visible because condition not met
            }
          }
        }
      }
      
      return true;
      
      // Check hiddenWhen condition
      if (prompt.hiddenWhen) {
        if (typeof prompt.hiddenWhen === 'object') {
          const field = prompt.hiddenWhen.field || prompt.hiddenWhen.id;
          const expectedValue = prompt.hiddenWhen.equals || prompt.hiddenWhen.value;
          if (field && allPrompts[field]) {
            const currentValue = allPrompts[field].value;
            if (String(currentValue) === String(expectedValue)) {
              return false; // Hidden when condition is met
            }
          }
        }
      }
      
      // Check visibility condition
      if (prompt.visibility) {
        if (typeof prompt.visibility === 'object') {
          const field = prompt.visibility.field || prompt.visibility.id;
          const expectedValue = prompt.visibility.equals || prompt.visibility.value;
          if (field && allPrompts[field]) {
            const currentValue = allPrompts[field].value;
            if (String(currentValue) !== String(expectedValue)) {
              return false; // Not visible because condition not met
            }
          }
        }
      }
      
      return true;
    };

    // Build complete payload with all quote data
    const items: any[] = [];
    const appliedDiscounts: string[] = [];
    let hasMultiQuantities = false;
    let globalQtyCounter = 0; // Counter for continuous Q1, Q2, Q3, Q4 numbering
    
    quoteItems.forEach((item: any) => {
      console.log('🔍 Processing item - ALL FIELDS:', JSON.stringify(item, null, 2));
      
      // Check if item has multiple quantities
      const itemHasMultiQuantities = item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1;
      
      if (itemHasMultiQuantities) {
        hasMultiQuantities = true;
        // Create one item per quantity row
        item.multi.rows.forEach((row: any, index: number) => {
          globalQtyCounter++; // Increment global counter
          const qtyLabel = `Q${globalQtyCounter}`; // Use global counter instead of local index
          let description = '';
          
          // Build description from prompts (ONLY VISIBLE ONES)
          if (item.prompts) {
            let promptsArray: any[] = [];
            
            // Handle both array and object formats
            if (Array.isArray(item.prompts)) {
              promptsArray = item.prompts;
            } else if (typeof item.prompts === 'object') {
              promptsArray = Object.entries(item.prompts).map(([key, value]) => ({
                id: key,
                ...(typeof value === 'object' ? value : { value })
              }));
            }
            
            // Convert to object for visibility checking
            const promptsObj = promptsArray.reduce((acc: any, p: any) => {
              acc[p.id] = p;
              return acc;
            }, {});
            
            if (promptsArray.length > 0) {
              description = promptsArray
                .filter(prompt => isPromptVisible(prompt.id, prompt.value, promptsObj, item.product_id || '')) // Filter only visible prompts
                .sort((a, b) => (a.order || 999) - (b.order || 999))
                .map((prompt) => {
                  if (prompt && 'label' in prompt && 'value' in prompt) {
                    // For the quantity prompt, use the value from this specific row
                    if (prompt.id === item.multi.qtyPrompt && row.qty) {
                      return `${prompt.label}: ${row.qty}`;
                    }
                    return `${prompt.label}: ${prompt.value}`;
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
              // Detect discount: either explicitly marked or has negative value
              const isDiscount = additional.is_discount === true || value < 0;
              
              if (isDiscount) {
                // Add to applied discounts list
                if (additional.name && !appliedDiscounts.includes(additional.name)) {
                  appliedDiscounts.push(additional.name);
                }
                // Calculate discount amount
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
          
          // Add discount field if there's a discount
          if (discountAmount > 0) {
            itemData.discount = discountAmount;
          }
          
          items.push(itemData);
        });
      } else {
        // Single item without multi quantities
        let description = '';
        
        // Build description from prompts (ONLY VISIBLE ONES)
        if (item.prompts) {
          let promptsArray: any[] = [];
          
          // Handle both array and object formats
          if (Array.isArray(item.prompts)) {
            promptsArray = item.prompts;
          } else if (typeof item.prompts === 'object') {
            promptsArray = Object.entries(item.prompts).map(([key, value]) => ({
              id: key,
              ...(typeof value === 'object' ? value : { value })
            }));
          }
          
          // Convert to object for visibility checking
          const promptsObj = promptsArray.reduce((acc: any, p: any) => {
            acc[p.id] = p;
            return acc;
          }, {});
          
          if (promptsArray.length > 0) {
            description = promptsArray
              .filter(prompt => isPromptVisible(prompt.id, prompt.value, promptsObj, item.product_id || '')) // Filter only visible prompts
              .sort((a, b) => (a.order || 999) - (b.order || 999))
              .map((prompt) => {
                if (prompt && 'label' in prompt && 'value' in prompt) {
                  return `${prompt.label}: ${prompt.value}`;
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
            // Detect discount: either explicitly marked or has negative value
            const isDiscount = additional.is_discount === true || value < 0;
            
            if (isDiscount) {
              // Add to applied discounts list
              if (additional.name && !appliedDiscounts.includes(additional.name)) {
                appliedDiscounts.push(additional.name);
              }
              // Calculate discount amount
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
        
        // Add discount field if there's a discount
        if (discountAmount > 0) {
          itemData.discount = discountAmount;
        } else if (item.discount_percentage && parseFloat(item.discount_percentage) > 0) {
          itemData.discount = parseFloat(item.discount_percentage);
        }
        
        items.push(itemData);
      }
    });

    // Calculate global discount from quote additionals
    let globalDiscount = 0;
    
    // Add quote additionals (ajustes sobre el presupuesto)
    if (quoteAdditionals && Array.isArray(quoteAdditionals) && quoteAdditionals.length > 0) {
      quoteAdditionals.forEach((additional: any) => {
        const value = additional.value || 0;
        // Detect discount: either explicitly marked or has negative value
        const isDiscount = additional.is_discount === true || value < 0;
        
        if (!isDiscount) {
          // Calculate price based on type
          let price = 0;
          const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
          
          if (additional.type === 'percentage') {
            // For percentage type, calculate the percentage of the current subtotal
            price = Math.round((subtotal * value / 100) * 100) / 100;
          } else if (additional.type === 'quantity_multiplier' || additional.type === 'multiplier') {
            // For multiplier type, calculate the additional amount
            // If multiplier is 1.5, the additional amount is 0.5 * subtotal
            price = Math.round((subtotal * (value - 1)) * 100) / 100;
          } else {
            // For net_amount or default, use the value directly
            price = Math.round(parseFloat(String(value)) * 100) / 100;
          }
          
          // Remove "Ajuste sobre el presupuesto/pedido" from name
          const cleanName = (additional.name || 'Ajuste')
            .replace(/\s*Ajuste sobre el presupuesto\s*/gi, '')
            .replace(/\s*Ajuste sobre el pedido\s*/gi, '')
            .trim() || 'Ajuste';
          
          const itemData: any = {
            name: cleanName,
            desc: '',
            units: 1,
            subtotal: price,
            taxes: ["s_iva_21"]
          };
          
          items.push(itemData);
        } else {
          // Add to applied discounts list
          if (additional.name && !appliedDiscounts.includes(additional.name)) {
            appliedDiscounts.push(additional.name);
          }
          // Calculate global discount
          const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
          
          if (additional.type === 'percentage') {
            globalDiscount += (subtotal * Math.abs(value)) / 100;
          } else {
            globalDiscount += Math.abs(value);
          }
        }
      });
    }
    
    globalDiscount = Math.round(globalDiscount * 100) / 100;

    // Add informative discount summary item if there are any discounts
    if (appliedDiscounts.length > 0) {
      items.push({
        name: `DESCUENTOS APLICADOS: ${appliedDiscounts.join(', ')}`,
        desc: '',
        units: 1,
        subtotal: 0,
        taxes: []
      });
    }

    const estimatePayload: any = {
      docType: 'estimate',
      date: Math.floor(new Date(quote.created_at).getTime() / 1000), // Unix timestamp
      contactId: contactId,
      desc: quote.description || 'Pruebas de EasyQuote',
      notes: quote.notes || '',
      items: items,
      paymentMethodId: '5ad06f6a2e1d93408570743e'
    };
    
    // Add sales channel ID if available
    if (salesChannelId) {
      estimatePayload.salesChannelId = salesChannelId;
    }
    
    // Add shipping hidden if any item has multi quantities
    if (hasMultiQuantities) {
      estimatePayload.shipping = 'hidden';
    }
    
    // Add global discount if exists
    if (globalDiscount > 0) {
      estimatePayload.discount = globalDiscount;
    }

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
