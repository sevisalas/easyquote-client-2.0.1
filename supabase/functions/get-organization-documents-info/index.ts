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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the user is a superadmin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    
    if (!user) {
      throw new Error('No autorizado');
    }

    // Check if user is superadmin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = roles?.some(r => r.role === 'superadmin');
    if (!isSuperAdmin) {
      throw new Error('Solo los superadministradores pueden acceder a esta función');
    }

    const { organizationId } = await req.json();
    
    if (!organizationId) {
      throw new Error('organizationId es requerido');
    }

    // Get organization data
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, api_user_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      throw new Error('Organización no encontrada');
    }

    console.log('Fetching data for organization:', org.name, 'with api_user_id:', org.api_user_id);

    // Get all user_ids in the organization
    const { data: members } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId);

    const userIds = members ? members.map(m => m.user_id) : [org.api_user_id];
    console.log('User IDs in organization:', userIds);

    // Fetch numbering formats
    const { data: formats, error: formatsError } = await supabaseAdmin
      .from('numbering_formats')
      .select('*')
      .eq('user_id', org.api_user_id);

    if (formatsError) {
      console.error('Error fetching formats:', formatsError);
      throw formatsError;
    }

    console.log('Formats found:', formats);

    // Fetch document counts for all organization members
    const { count: quotesCount, error: quotesError } = await supabaseAdmin
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds);

    if (quotesError) {
      console.error('Error counting quotes:', quotesError);
      throw quotesError;
    }

    console.log('Quotes count:', quotesCount);

    const { count: ordersCount, error: ordersError } = await supabaseAdmin
      .from('sales_orders')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds);

    if (ordersError) {
      console.error('Error counting orders:', ordersError);
      throw ordersError;
    }

    console.log('Orders count:', ordersCount);

    const quoteFormat = formats?.find(f => f.document_type === 'quote');
    const orderFormat = formats?.find(f => f.document_type === 'order');

    return new Response(
      JSON.stringify({
        quoteFormat: quoteFormat || null,
        orderFormat: orderFormat || null,
        quotesCount: quotesCount || 0,
        ordersCount: ordersCount || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-organization-documents-info:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
