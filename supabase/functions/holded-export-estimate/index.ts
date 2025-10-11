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

    console.log('📦 Quote items fetched:', JSON.stringify(quoteItems, null, 2));

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

    // Build complete payload with all quote data using data already in database
    const items = quoteItems.map((item: any) => {
      console.log('🔍 Processing item - ALL FIELDS:', JSON.stringify(item, null, 2));
      
      let description = '';
      
      // Build description from prompts in the format "LABEL: value"
      if (item.prompts && typeof item.prompts === 'object') {
        const promptEntries = Object.entries(item.prompts);
        console.log('📝 Prompt entries:', promptEntries);
        if (promptEntries.length > 0) {
          description = promptEntries
            .map(([key, promptData]: [string, any]) => {
              // Handle both new format {label, value} and old format (just value)
              if (promptData && typeof promptData === 'object' && 'label' in promptData && 'value' in promptData) {
                return `${promptData.label}: ${promptData.value}`;
              }
              // Fallback to old format - try to get label from outputs
              const promptLabels: Record<string, string> = {};
              if (item.outputs && Array.isArray(item.outputs)) {
                const promptsOutput = item.outputs.find((out: any) => out.type === 'Prompts');
                if (promptsOutput && promptsOutput.value && typeof promptsOutput.value === 'object') {
                  Object.entries(promptsOutput.value).forEach(([k, val]: [string, any]) => {
                    if (val && typeof val === 'object' && val.label) {
                      promptLabels[k] = val.label;
                    }
                  });
                }
              }
              const label = promptLabels[key] || key;
              const valueStr = typeof promptData === 'object' ? JSON.stringify(promptData) : String(promptData);
              return `${label}: ${valueStr}`;
            })
            .join('\n');
        }
      }
      
      // Add outputs to description (excluding price fields)
      if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
        console.log('📊 Outputs found:', item.outputs.length);
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
      
      console.log('📄 Final description for Holded desc:', description);
      console.log('📝 Item description field for Holded name:', item.description);
      
      return {
        name: item.description || item.product_name || 'Producto',
        desc: description,
        units: item.quantity || 1,
        price: parseFloat(item.price) || 0,
        tax: 21,
        discount: parseFloat(item.discount_percentage) || 0
      };
    });

    const estimatePayload = {
      docType: 'estimate',
      date: Math.floor(new Date(quote.created_at).getTime() / 1000), // Unix timestamp
      contactId: contactId,
      desc: quote.description || quote.title || '',
      notes: quote.notes || '',
      items: items,
      ...(quote.hide_holded_totals && { shipping: 'hidden' })
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
