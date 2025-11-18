import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Holded integration ID
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .single();

    if (integrationError || !integration) {
      console.error('Error fetching Holded integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization's Holded access token
    const { data: access, error: accessError } = await supabaseClient
      .from('organization_integration_access')
      .select('access_token_encrypted, is_active')
      .eq('organization_id', organizationId)
      .eq('integration_id', integration.id)
      .single();

    if (accessError || !access || !access.is_active) {
      console.error('Error fetching Holded access:', accessError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not configured or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt the access token from bytes
    const decoder = new TextDecoder();
    const accessToken = decoder.decode(access.access_token_encrypted);

    // Call Holded API to get contacts
    const holdedResponse = await fetch('https://api.holded.com/api/contacts', {
      method: 'GET',
      headers: {
        'key': accessToken,
        'Accept': 'application/json'
      }
    });

    if (!holdedResponse.ok) {
      const errorText = await holdedResponse.text();
      console.error('Holded API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch contacts from Holded', details: errorText }),
        { status: holdedResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const holdedData = await holdedResponse.json();

    // Transform Holded contacts to our format and check if they exist in customers
    const holdedIds = holdedData.map((c: any) => c.id);
    
    // Get existing customers from our database
    const { data: existingCustomers } = await supabaseClient
      .from('customers')
      .select('holded_id')
      .eq('organization_id', organizationId)
      .eq('source', 'holded')
      .in('holded_id', holdedIds);

    const existingHoldedIds = new Set(existingCustomers?.map(c => c.holded_id) || []);

    const contacts = holdedData.map((contact: any) => ({
      id: contact.id,
      name: contact.name || contact.customName,
      email: contact.email,
      code: contact.code,
      vatNumber: contact.vatnumber,
      existsInDb: existingHoldedIds.has(contact.id)
    }));

    return new Response(
      JSON.stringify({ contacts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in holded-contacts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
