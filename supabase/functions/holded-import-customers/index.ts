import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';
const pickString = (...values: any[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const buildContactAddress = (contact: any): string | null => {
  const billObj = typeof contact?.billAddress === 'object' && contact?.billAddress !== null ? contact.billAddress : {};
  const addressObj = typeof contact?.address === 'object' && contact?.address !== null ? contact.address : {};
  const billingObj = typeof contact?.billingAddress === 'object' && contact?.billingAddress !== null ? contact.billingAddress : {};

  const street = pickString(
    contact?.billAddress,
    contact?.address,
    billObj?.address,
    billObj?.street,
    billObj?.line1,
    addressObj?.address,
    addressObj?.street,
    addressObj?.line1,
    billingObj?.address,
    billingObj?.street,
    billingObj?.line1,
  );

  const city = pickString(contact?.billCity, contact?.city, billObj?.city, addressObj?.city, billingObj?.city);
  const province = pickString(contact?.billProvince, contact?.province, billObj?.province, addressObj?.province, billingObj?.province, billingObj?.state);
  const postalCode = pickString(contact?.billPostalCode, contact?.zipcode, contact?.postalCode, billObj?.postalCode, addressObj?.postalCode, billingObj?.postalCode, billingObj?.zip);
  const country = pickString(contact?.billCountry, contact?.country, billObj?.country, addressObj?.country, billingObj?.country);

  const parts = [street, city, province, postalCode, country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};
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

    // Validate organization and access
    const { data: organization, error: organizationError } = await supabaseClient
      .from('organizations')
      .select('id, api_user_id')
      .eq('id', organizationId)
      .single();

    if (organizationError || !organization) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isOwner = organization.api_user_id === user.id;
    if (!isOwner) {
      const { data: membership, error: membershipError } = await supabaseClient
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError || !membership) {
        return new Response(
          JSON.stringify({ error: 'Organization not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get Holded integration configuration
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

    // Get organization's Holded API key
    const { data: access, error: accessError } = await supabaseClient
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', organizationId)
      .eq('integration_id', integration.id)
      .single();

    if (accessError || !access || !access.access_token_encrypted) {
      console.error('Error fetching Holded access:', accessError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not configured for this organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt the API key
    const { data: decryptedKey, error: decryptError } = await supabaseClient
      .rpc('decrypt_credential', { encrypted_data: access.access_token_encrypted });

    if (decryptError || !decryptedKey) {
      console.error('Error decrypting Holded API key:', decryptError);
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt Holded API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = decryptedKey.trim();

    // Existing contacts in this organization
    const { data: existingCustomers, error: existingError } = await supabaseClient
      .from('customers')
      .select('holded_id')
      .eq('organization_id', organizationId)
      .eq('source', 'holded')
      .not('holded_id', 'is', null);

    if (existingError) {
      console.error('Error fetching existing customers:', existingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch existing customers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingHoldedIds = new Set(existingCustomers?.map(c => c.holded_id) || []);

    // Call Holded API to get contacts (paginated)
    const holdedContacts: any[] = [];
    let page = 1;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      const holdedResponse = await fetch(
        `https://api.holded.com/api/invoicing/v1/contacts?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            key: apiKey,
            Accept: 'application/json'
          }
        }
      );

      const rawBody = await holdedResponse.text();

      if (!holdedResponse.ok) {
        console.error('Holded API error:', holdedResponse.status, rawBody);
        return new Response(
          JSON.stringify({
            error: 'Failed to fetch contacts from Holded',
            details: rawBody,
            status: holdedResponse.status,
          }),
          { status: holdedResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let pageContacts: any[] = [];
      try {
        const parsed = JSON.parse(rawBody);
        pageContacts = Array.isArray(parsed) ? parsed : [];
      } catch {
        console.error('Invalid Holded response (non-JSON):', rawBody?.slice?.(0, 300));
        return new Response(
          JSON.stringify({
            error: 'Invalid response from Holded API',
            details: 'Response is not valid JSON',
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (pageContacts.length === 0) {
        hasMore = false;
      } else {
        holdedContacts.push(...pageContacts);
        if (pageContacts.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    // Filter client contacts
    const isClientContact = (contact: any) => !contact?.type || contact.type === 'client';
    const clientContacts = holdedContacts.filter((contact: any) => isClientContact(contact));
    const newContactsCount = clientContacts.filter((contact: any) => !existingHoldedIds.has(contact.id)).length;

    console.log(`Total contacts: ${holdedContacts.length}, Clients: ${clientContacts.length}, New clients: ${newContactsCount}`);

    if (clientContacts.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No se encontraron clientes en Holded',
          total: 0,
          new: 0,
          imported: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert all client contacts to also refresh existing address/phone/email
    const batchSize = 100;
    let importedCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < clientContacts.length; i += batchSize) {
      const batch = clientContacts.slice(i, i + batchSize);

      const customersToUpsert = batch.map((contact: any) => ({
        organization_id: organizationId,
        user_id: organization.api_user_id,
        source: 'holded',
        holded_id: contact.id,
        name: contact.name || contact.customName || 'Sin nombre',
        email: pickString(contact.email) || null,
        phone: pickString(contact.phone, contact.mobile) || null,
        notes: pickString(contact.notes, contact.note) || null,
        address: buildContactAddress(contact),
      }));

      const { data, error } = await supabaseClient
        .from('customers')
        .upsert(customersToUpsert, {
          onConflict: 'holded_id,organization_id',
          ignoreDuplicates: false,
        })
        .select('id');

      if (error) {
        console.error('Error upserting batch:', error);
        errors.push({ batch: i / batchSize, error: error.message });
      } else {
        importedCount += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Importación completada',
        total: clientContacts.length,
        new: newContactsCount,
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
