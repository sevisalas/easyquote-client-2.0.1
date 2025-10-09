import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const HOLDED_API_BASE = "https://api.holded.com/api";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId } = await req.json();
    
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns this organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .eq('api_user_id', user.id)
      .single();

    if (orgError || !org) {
      console.error('Organization error:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Holded integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .single();

    if (integrationError || !integration) {
      console.error('Integration error:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    const { data: accessData, error: accessError } = await supabase
      .from('organization_integration_access')
      .select('access_token')
      .eq('organization_id', organizationId)
      .eq('integration_id', integration.id)
      .eq('is_active', true)
      .single();

    if (accessError || !accessData?.access_token) {
      console.error('Access token error:', accessError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not configured or inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = accessData.access_token;

    // Fetch all contacts from Holded (paginated)
    console.log('Fetching contacts from Holded...');
    let allContacts: any[] = [];
    let page = 1;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${HOLDED_API_BASE}/invoicing/v1/contacts?page=${page}&limit=${limit}`,
        {
          headers: {
            'accept': 'application/json',
            'key': apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Holded API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ 
            error: `Holded API error: ${response.status}`,
            details: errorText.substring(0, 500)
          }),
          { 
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error('Holded API returned non-JSON:', errorText.substring(0, 500));
        return new Response(
          JSON.stringify({ 
            error: 'Holded API key inválida o error de autenticación',
            details: 'Verifica que tu API key de Holded sea correcta'
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const contacts = await response.json();
      
      if (!contacts || contacts.length === 0) {
        hasMore = false;
      } else {
        allContacts = allContacts.concat(contacts);
        console.log(`Fetched page ${page}: ${contacts.length} contacts (total: ${allContacts.length})`);
        
        if (contacts.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`Total contacts fetched: ${allContacts.length}`);

    // Transform and insert contacts
    const contactsToInsert = allContacts.map((contact: any) => ({
      holded_id: contact.id,
      name: contact.name || 'Sin nombre',
      email: contact.email || null,
      phone: contact.phone || null,
      mobile: contact.mobile || null,
      organization_id: organizationId,
    }));

    // Insert in batches of 100
    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < contactsToInsert.length; i += 100) {
      const batch = contactsToInsert.slice(i, i + 100);
      
      const { data, error } = await supabase
        .from('holded_contacts')
        .upsert(batch, { 
          onConflict: 'holded_id,organization_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error(`Error inserting batch ${i / 100 + 1}:`, error);
        errors += batch.length;
      } else {
        imported += data?.length || 0;
        console.log(`Batch ${i / 100 + 1} inserted: ${data?.length} contacts`);
      }
    }

    console.log(`Import complete: ${imported} contacts imported/updated, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allContacts.length,
        imported,
        errors,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error importing Holded contacts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
