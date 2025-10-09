import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Holded integration configuration
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id, configuration')
      .eq('name', 'Holded')
      .single();

    if (integrationError || !integration) {
      console.error('Error fetching Holded integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization's Holded API key
    const { data: access, error: accessError } = await supabaseClient
      .from('organization_integration_access')
      .select('access_token')
      .eq('organization_id', organizationId)
      .eq('integration_id', integration.id)
      .single();

    if (accessError || !access) {
      console.error('Error fetching Holded access:', accessError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not configured for this organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = access.access_token;

    // Get existing customers with holded_id to avoid duplicates
    const { data: existingCustomers, error: existingError } = await supabaseClient
      .from('customers')
      .select('holded_id')
      .eq('user_id', user.id)
      .not('holded_id', 'is', null);

    if (existingError) {
      console.error('Error fetching existing customers:', existingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch existing customers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingHoldedIds = new Set(existingCustomers?.map(c => c.holded_id) || []);

    // Call Holded API to get contacts
    const holdedResponse = await fetch('https://api.holded.com/api/contacts', {
      method: 'GET',
      headers: {
        'key': apiKey,
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

    const holdedContacts = await holdedResponse.json();

    // Filter out contacts that already exist
    const newContacts = holdedContacts.filter((contact: any) => 
      !existingHoldedIds.has(contact.id)
    );

    if (newContacts.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No new contacts to import',
          total: holdedContacts.length,
          new: 0,
          imported: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process and insert new contacts in batches
    const batchSize = 50;
    let importedCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < newContacts.length; i += batchSize) {
      const batch = newContacts.slice(i, i + batchSize);
      
      const customersToInsert = batch.map((contact: any) => ({
        user_id: user.id,
        holded_id: contact.id,
        name: contact.name || contact.customName || 'Sin nombre',
        email: contact.email || '',
        phone: contact.phone || '',
        notes: contact.notes || '',
        address: contact.billAddress || ''
      }));

      const { data, error } = await supabaseClient
        .from('customers')
        .insert(customersToInsert)
        .select();

      if (error) {
        console.error('Error inserting batch:', error);
        errors.push({ batch: i / batchSize, error: error.message });
      } else {
        importedCount += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Import completed',
        total: holdedContacts.length,
        new: newContacts.length,
        imported: importedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in holded-import-customers:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
