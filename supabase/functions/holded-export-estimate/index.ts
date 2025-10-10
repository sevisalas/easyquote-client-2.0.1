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
    const items = quoteItems.map((item: any) => {
      let description = item.description || '';
      
      // Add prompts to description
      if (item.prompts && typeof item.prompts === 'object') {
        const promptsText = Object.entries(item.prompts)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        if (promptsText) {
          description += (description ? '\n\n' : '') + 'Prompts:\n' + promptsText;
        }
      }
      
      // Add item additionals to description
      if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
        const additionalsText = item.item_additionals
          .map((add: any) => `${add.name}: ${add.type === 'percentage' ? add.value + '%' : add.value + '€'}`)
          .join('\n');
        if (additionalsText) {
          description += (description ? '\n\n' : '') + 'Ajustes:\n' + additionalsText;
        }
      }
      
      return {
        name: item.product_name || item.name || 'Producto',
        desc: description,
        units: item.quantity || 1,
        price: parseFloat(item.price) || 0,
        tax: 21, // IVA estándar España
        discount: parseFloat(item.discount_percentage) || 0
      };
    });

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
