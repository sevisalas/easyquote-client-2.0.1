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

    // Get quote with customer and items
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers(id, name, email, phone, address, holded_id),
        quote_items(*)
      `)
      .eq('id', quoteId)
      .eq('user_id', user.id)
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quoteError);
      throw new Error('Quote not found');
    }

    if (!quote.customer?.holded_id) {
      throw new Error('Customer does not have a Holded contact ID. Please sync the customer with Holded first.');
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
    const items = quote.quote_items.map((item: any) => {
      const itemData: any = {
        name: item.product_name || item.name || 'Product',
        desc: item.description || '',
        units: item.quantity || 1,
        subtotal: parseFloat(item.price) || 0,
        taxes: ['s_iva_21'] // Default IVA 21%
      };

      // Add discount if exists
      if (item.discount_percentage && item.discount_percentage > 0) {
        itemData.discount = parseFloat(item.discount_percentage);
      }

      return itemData;
    });

    // Add header item with quote description if exists
    if (quote.description) {
      items.unshift({
        name: quote.quote_number || 'Presupuesto',
        desc: quote.description,
        units: 1,
        subtotal: 0,
        taxes: []
      });
    }

    // Build estimate payload
    const estimatePayload = {
      contactId: quote.customer.holded_id,
      applyContactDefaults: true,
      desc: `Presupuesto de EasyQuote numero ${quote.quote_number}`,
      date: new Date().toISOString().split('T')[0],
      items: items,
      contactName: quote.customer.name,
      contactAddress: quote.customer.address || '',
      contactEmail: quote.customer.email || '',
      contactPhone: quote.customer.phone || ''
    };

    console.log('Sending estimate to Holded:', JSON.stringify(estimatePayload, null, 2));

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
