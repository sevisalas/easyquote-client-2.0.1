import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const HOLDED_API_BASE = "https://api.holded.com/api";

// Background task to import contacts
async function importContactsBackground(
  organizationId: string, 
  apiKey: string,
  supabaseUrl: string,
  supabaseKey: string
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Background task: Starting Holded contacts import...');
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
        console.error('Holded API error:', response.status, await response.text());
        break;
      }

      const contacts = await response.json();
      
      if (!contacts || contacts.length === 0) {
        hasMore = false;
      } else {
        allContacts = allContacts.concat(contacts);
        console.log(`Background: Fetched page ${page}: ${contacts.length} contacts (total: ${allContacts.length})`);
        
        if (contacts.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`Background: Total contacts fetched: ${allContacts.length}`);

    // Transform and insert contacts in batches
    const contactsToInsert = allContacts.map((contact: any) => ({
      holded_id: contact.id,
      name: contact.name || 'Sin nombre',
      email: contact.email || null,
      phone: contact.phone || null,
      mobile: contact.mobile || null,
      organization_id: organizationId,
    }));

    let imported = 0;
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
        console.error(`Background: Error inserting batch ${i / 100 + 1}:`, error);
        errors += batch.length;
      } else {
        imported += data?.length || 0;
        console.log(`Background: Batch ${i / 100 + 1} inserted: ${data?.length} contacts`);
      }
    }

    console.log(`Background: Import complete - ${imported} contacts imported/updated, ${errors} errors`);
  } catch (error) {
    console.error('Background: Error importing contacts:', error);
  }
}

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

    // Get organization integration access
    const { data: accessData, error: accessError } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted, is_active')
      .eq('organization_id', organizationId)
      .eq('integration_id', integration.id)
      .maybeSingle();

    if (accessError || !accessData || !accessData.is_active) {
      console.error('Error getting Holded access:', accessError);
      return new Response(
        JSON.stringify({ error: 'Holded integration not configured or inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt API key - handle Supabase's bytea format correctly
    console.log('Raw access_token_encrypted:', JSON.stringify(accessData.access_token_encrypted));
    
    let apiKey: string;
    const encrypted = accessData.access_token_encrypted;
    
    // Supabase returns bytea as {data: [...], type: "Buffer"}
    if (encrypted && typeof encrypted === 'object' && 'data' in encrypted && Array.isArray(encrypted.data)) {
      // First decode the Buffer to get the string
      const decoder = new TextDecoder();
      const decodedString = decoder.decode(new Uint8Array(encrypted.data));
      
      // Check if it's a JSON object like {"0":56,"1":56...}
      try {
        const jsonObj = JSON.parse(decodedString);
        if (typeof jsonObj === 'object' && !Array.isArray(jsonObj)) {
          // Convert the JSON object to actual string
          const chars = Object.keys(jsonObj).sort((a, b) => parseInt(a) - parseInt(b)).map(k => String.fromCharCode(jsonObj[k]));
          apiKey = chars.join('').trim();
          console.log('Decoded from JSON object format');
        } else {
          apiKey = decodedString.trim();
          console.log('Using decoded string');
        }
      } catch {
        // Not JSON, use as is
        apiKey = decodedString.trim();
        console.log('Using decoded string (not JSON)');
      }
    } else if (typeof encrypted === 'string') {
      apiKey = encrypted.trim();
      console.log('Using string directly');
    } else {
      console.error('Unknown encrypted data format:', typeof encrypted);
      return new Response(
        JSON.stringify({ error: 'Formato de API key no válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate the API key is not empty
    if (!apiKey || apiKey.length === 0) {
      console.error('API key is empty after decoding');
      return new Response(
        JSON.stringify({ error: 'API key no encontrado o vacío' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✓ API key decoded successfully');
    console.log('✓ Length:', apiKey.length);
    console.log('✓ First 10 chars:', apiKey.substring(0, 10));
    console.log('✓ Last 5 chars:', apiKey.substring(apiKey.length - 5));

    // Validate API key before starting background task
    console.log('Validating Holded API key...');
    const testResponse = await fetch(
      `${HOLDED_API_BASE}/invoicing/v1/contacts?page=1&limit=1`,
      {
        headers: {
          'accept': 'application/json',
          'key': apiKey,
        },
      }
    );

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('API key validation failed:', testResponse.status, errorText);
      
      let errorMessage = 'API key inválida o sin acceso';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.info) {
          errorMessage = errorData.info;
        }
      } catch (e) {
        // Use default error message
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          status: testResponse.status 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('API key validated successfully');

    // Import contacts directly
    console.log('Starting Holded contacts import...');
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
        console.error('Holded API error:', response.status, await response.text());
        break;
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

    // Transform and insert contacts in batches
    const contactsToInsert = allContacts.map((contact: any) => ({
      holded_id: contact.id,
      name: contact.name || 'Sin nombre',
      email: contact.email || null,
      phone: contact.phone || null,
      mobile: contact.mobile || null,
      organization_id: organizationId,
    }));

    let imported = 0;
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

    console.log(`Import complete - ${imported} contacts imported/updated, ${errors} errors`);

    // Return success response with details
    return new Response(
      JSON.stringify({
        success: true,
        imported: imported,
        errors: errors,
        total: allContacts.length,
        message: `${imported} contactos importados/actualizados`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error starting import:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
