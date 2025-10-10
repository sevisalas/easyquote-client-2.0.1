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

    // Get Holded contact directly (no local customers allowed)
    if (!quote.customer_id) {
      throw new Error('Quote does not have a customer assigned');
    }

    const { data: holdedContact, error: contactError } = await supabase
      .from('holded_contacts')
      .select('holded_id')
      .eq('id', quote.customer_id)
      .single();

    if (contactError || !holdedContact) {
      throw new Error('Holded contact not found for this quote. Only Holded contacts can be exported.');
    }

    if (!holdedContact.holded_id) {
      throw new Error('Holded contact does not have a valid Holded ID');
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

    // Get organization to get Holded API key
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('api_user_id', user.id)
      .single();

    if (orgError || !organization) {
      console.error('Organization not found:', orgError);
      throw new Error('Organization not found');
    }

    // Get Holded integration and access token
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .single();

    if (integrationError || !integration) {
      console.error('Holded integration not found:', integrationError);
      throw new Error('Holded integration not found');
    }

    const { data: accessData, error: accessError } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', organization.id)
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .single();

    if (accessError || !accessData) {
      console.error('Holded access not found:', accessError);
      throw new Error('Holded integration not active for this organization');
    }

    // Decrypt the API key
    const apiKey = new TextDecoder().decode(accessData.access_token_encrypted);
    console.log('Got Holded API key');

    // Build items array
    const items: any[] = [];
    
    (quoteItems || []).forEach((item: any) => {
      // Build description with prompts and item additionals
      let desc = '';
      
      // Add prompts (label and value)
      if (item.prompts && typeof item.prompts === 'object') {
        Object.entries(item.prompts).forEach(([key, value]) => {
          desc += `${key}: ${value}\n`;
        });
      }
      
      // Add item additionals (not quote additionals)
      if (item.item_additionals && Array.isArray(item.item_additionals)) {
        item.item_additionals.forEach((additional: any) => {
          desc += `${additional.name}: ${additional.value}\n`;
        });
      }
      
      desc = desc.trim();
      
      // Get Price output
      let priceOutput = 0;
      if (item.outputs && Array.isArray(item.outputs)) {
        const priceObj = item.outputs.find((out: any) => out.type === 'Price' || out.name === 'PRECIO');
        if (priceObj && priceObj.value) {
          priceOutput = parseFloat(String(priceObj.value).replace(',', '.'));
        }
      }
      
      // If multi exists, create one item per quantity row
      if (item.multi && item.multi.rows && Array.isArray(item.multi.rows)) {
        item.multi.rows.forEach((row: any, index: number) => {
          const itemData: any = {
            name: item.description || item.product_name || 'Artículo',
            desc: desc,
            units: row.qty || 1,
            subtotal: parseFloat(String(row.totalStr || row.unit || 0).replace(',', '.')),
            taxes: ['s_iva_21']
          };
          
          if (item.discount_percentage && item.discount_percentage > 0) {
            itemData.discount = parseFloat(item.discount_percentage);
          }
          
          items.push(itemData);
        });
      } else {
        // Single item without multi
        const itemData: any = {
          name: item.description || item.product_name || 'Artículo',
          desc: desc,
          units: item.quantity || 1,
          subtotal: priceOutput || parseFloat(item.price) || 0,
          taxes: ['s_iva_21']
        };
        
        if (item.discount_percentage && item.discount_percentage > 0) {
          itemData.discount = parseFloat(item.discount_percentage);
        }
        
        items.push(itemData);
      }
    });

    // Build estimate payload - only contactId, no customer data
    const estimatePayload = {
      contactId: holdedContact.holded_id,
      applyContactDefaults: true,
      desc: `Presupuesto EasyQuote ${quote.quote_number}`,
      date: new Date().toISOString().split('T')[0],
      items: items
    };

    console.log('Sending estimate to Holded:', JSON.stringify(estimatePayload, null, 2));
    console.log('Holded API URL:', HOLDED_API_URL);
    console.log('API Key (primeros 10 chars):', apiKey.substring(0, 10) + '...');

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
          holded_estimate_number: holdedData.docNumber || null,
          status: 'sent'
        })
        .eq('id', quoteId);

      console.log('Quote updated with Holded estimate ID:', holdedData.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        estimateId: holdedData.id,
        estimateNumber: holdedData.docNumber,
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
