import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting holded-external-customers function ===');

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth header present, creating supabase client');

    // Create client for current project
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client created');

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User authentication error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Check organization settings
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('holded_external_customers')
      .eq('api_user_id', user.id)
      .maybeSingle();

    if (orgError) {
      console.error('Error fetching organization:', orgError.message);
      return new Response(
        JSON.stringify({ error: 'Error fetching organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Organization data:', orgData);

    // Return empty if not enabled
    if (!orgData || !orgData.holded_external_customers) {
      console.log('holded_external_customers not enabled for this organization');
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Connecting to external Supabase project');

    // Connect to external project
    const externalSupabaseUrl = 'https://sdvthvotbiqgjzsdnbju.supabase.co';
    const externalSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnRodm90YmlxZ2p6c2RuYmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNjcyNjIsImV4cCI6MjA3MTk0MzI2Mn0.ObR-zEgGs7GFxHsrp8z9jG98rtwgn6Kxd_TOTCU8ShU';
    
    const externalSupabase = createClient(externalSupabaseUrl, externalSupabaseKey);
    console.log('External Supabase client created');

    // Fetch contacts
    console.log('Fetching contacts from holded_contacts_index');
    const { data: contacts, error: contactsError } = await externalSupabase
      .from('holded_contacts_index')
      .select('*')
      .order('name', { ascending: true });

    if (contactsError) {
      console.error('Error fetching external contacts:', contactsError.message);
      return new Response(
        JSON.stringify({ error: 'Error fetching external contacts', details: contactsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully fetched ${contacts?.length || 0} contacts`);

    // Transform data
    const transformedContacts = (contacts || []).map(contact => ({
      id: contact.holded_id,
      name: contact.name || '',
      email: contact.email_original || '',
      phone: '',
      notes: '',
      created_at: '',
      holded_id: contact.holded_id,
      code: contact.code || '',
      vatnumber: contact.vatnumber || '',
      source: 'holded',
    }));

    console.log('Returning transformed contacts');
    return new Response(
      JSON.stringify({ data: transformedContacts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== Unexpected error in holded-external-customers ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
