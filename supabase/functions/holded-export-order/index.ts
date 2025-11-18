import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

const HOLDED_API_URL = 'https://api.holded.com/api/invoicing/v1/documents/salesorder';

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

    const { orderId } = await req.json();
    console.log('Exporting sales order to Holded:', orderId);

    if (!orderId) {
      throw new Error('orderId is required');
    }

    // Get sales order
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      throw new Error('Order not found');
    }

    // Verify user has access to this order
    if (order.user_id !== user.id) {
      const { data: userOrg } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      const { data: orderOwnerOrg } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', order.user_id)
        .single();

      if (!userOrg || !orderOwnerOrg || userOrg.organization_id !== orderOwnerOrg.organization_id) {
        throw new Error('No tienes permiso para exportar este pedido');
      }
    }

    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', orderId)
      .order('position');

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      throw new Error('Failed to fetch order items');
    }

    // Get order additionals
    const { data: orderAdditionals, error: additionalsError } = await supabase
      .from('sales_order_additionals')
      .select('*')
      .eq('sales_order_id', orderId);

    if (additionalsError) {
      console.error('Error fetching order additionals:', additionalsError);
    }

    console.log('📦 Order items fetched:', JSON.stringify(orderItems, null, 2));
    console.log('📦 Order additionals:', JSON.stringify(orderAdditionals || [], null, 2));

    // Get Holded contact ID and contact data from customers table
    let contactId = null;
    let contactData: any = null;
    
    if (order.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', order.customer_id)
        .single();
      
      if (customer?.holded_id) {
        contactId = customer.holded_id;
        contactData = customer;
        console.log('Found customer with holded_id:', contactId, contactData.name);
      }
    }
        console.log('Found contact from customer.holded_id:', contactId, contactData.name);
      }
    }

    if (!contactId) {
      console.error('Order data:', { 
        customer_id: order.customer_id, 
        holded_contact_id: order.holded_contact_id 
      });
      throw new Error('No se encontró contactId de Holded para este cliente. El cliente debe estar sincronizado con Holded.');
    }

    // Get the sales account from the order creator
    let salesChannelId = null;
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('cuenta_holded')
      .eq('user_id', order.user_id)
      .maybeSingle();
    
    if (memberData?.cuenta_holded) {
      salesChannelId = memberData.cuenta_holded;
      console.log('Using sales account:', salesChannelId);
    }

    // Use API key directly from environment (same as export-estimate)
    const apiKey = '88610992d47b9783e7703c488a8c01cf';
    console.log('Using Holded API key');

    // Helper function to check if prompt is visible
    const isPromptVisible = (prompt: any, allPrompts: Record<string, any>): boolean => {
      // If no visibility conditions, it's visible
      if (!prompt.hiddenWhen && !prompt.visibility) return true;
      
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

    // Build complete payload with all order data
    const items: any[] = [];
    
    orderItems.forEach((item: any) => {
      console.log('🔍 Processing item:', JSON.stringify(item, null, 2));
      
      let description = '';
      
      // Build description from prompts (ONLY VISIBLE ONES)
      if (item.prompts) {
        let promptsArray: any[] = [];
        
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
            .filter(prompt => isPromptVisible(prompt, promptsObj)) // Filter only visible prompts
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
      
      // Add outputs to description
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
      
      // Get price
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
      
      price = Math.round(price * 100) / 100;
      
      const itemData: any = {
        name: item.product_name || 'Producto',
        desc: description,
        units: item.quantity || 1,
        subtotal: price,
        taxes: ["s_iva_21"]
      };
      
      items.push(itemData);
    });

    // Add order additionals
    if (orderAdditionals && Array.isArray(orderAdditionals) && orderAdditionals.length > 0) {
      orderAdditionals.forEach((additional: any) => {
        const value = additional.value || 0;
        const isDiscount = additional.is_discount === true || value < 0;
        
        if (!isDiscount) {
          let price = 0;
          const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
          
          if (additional.type === 'percentage') {
            price = Math.round((subtotal * value / 100) * 100) / 100;
          } else if (additional.type === 'quantity_multiplier' || additional.type === 'multiplier') {
            price = Math.round((subtotal * (value - 1)) * 100) / 100;
          } else {
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
        }
      });
    }

    // Build the payload for Holded API
    const payload: any = {
      contactId,
      contactName: contactData?.name || '',
      desc: order.description || order.title || '',
      date: Math.floor(new Date(order.order_date).getTime() / 1000),
      items
    };

    // Add contact address information if available
    if (contactData?.address) {
      payload.contactAddress = contactData.address;
    }
    
    // Add contact email if available
    if (contactData?.email) {
      payload.contactEmail = contactData.email;
    }
    
    // Add contact phone if available
    if (contactData?.phone || contactData?.mobile) {
      payload.contactPhone = contactData.phone || contactData.mobile;
    }

    if (salesChannelId) {
      payload.salesChannelId = salesChannelId;
    }

    if (order.delivery_date) {
      payload.deliveryDate = Math.floor(new Date(order.delivery_date).getTime() / 1000);
    }

    if (order.notes) {
      payload.notes = order.notes;
    }

    console.log('📤 Sending to Holded:', JSON.stringify(payload, null, 2));

    // Send to Holded API
    const holdedResponse = await fetch(HOLDED_API_URL, {
      method: 'POST',
      headers: {
        'Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await holdedResponse.text();
    console.log('Holded raw response:', responseText);

    if (!holdedResponse.ok) {
      console.error('Holded API error:', responseText);
      throw new Error(`Holded API error: ${responseText}`);
    }

    const holdedData = JSON.parse(responseText);
    console.log('✅ Order exported to Holded:', holdedData);

    // Holded returns an array, get the first element
    const holdedResult = Array.isArray(holdedData) ? holdedData[0] : holdedData;

    // Update order with Holded IDs
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({
        holded_document_id: holdedResult.id,
        holded_document_number: holdedResult.invoiceNum || null,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order with Holded data:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        holdedId: holdedResult.id,
        holdedNumber: holdedResult.invoiceNum 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in holded-export-order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
