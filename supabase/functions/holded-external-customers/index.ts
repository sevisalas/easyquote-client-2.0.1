import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting holded-external-customers function');

    // Get the authorization header from the request to verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create client for current project to verify user and get organization
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Error getting user:', userError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Check if user's organization has holded_external_customers enabled
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('holded_external_customers')
      .eq('api_user_id', user.id)
      .maybeSingle();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      throw orgError;
    }

    // If user is not in an organization or holded_external_customers is false, return empty array
    if (!orgData || !orgData.holded_external_customers) {
      console.log('Organization does not have holded_external_customers enabled');
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching external Holded contacts');

    // Connect to external Supabase project
    const externalSupabaseUrl = 'https://sdvthvotbiqgjzsdnbju.supabase.co';
    const externalSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnRodm90YmlxZ2p6c2RuYmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNjcyNjIsImV4cCI6MjA3MTk0MzI2Mn0.ObR-zEgGs7GFxHsrp8z9jG98rtwgn6Kxd_TOTCU8ShU';
    
    const externalSupabase = createClient(externalSupabaseUrl, externalSupabaseKey);

    // Fetch contacts from external database
    const { data: contacts, error: contactsError } = await externalSupabase
      .from('holded_contacts_index')
      .select('*')
      .order('name', { ascending: true });

    if (contactsError) {
      console.error('Error fetching external contacts:', contactsError);
      throw contactsError;
    }

    console.log(`Fetched ${contacts?.length || 0} external contacts`);

    // Transform the data to match the expected format
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

    return new Response(
      JSON.stringify({ data: transformedContacts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in holded-external-customers function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
