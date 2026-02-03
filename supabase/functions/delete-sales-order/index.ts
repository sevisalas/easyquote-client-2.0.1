import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =========== AUTHORIZATION CHECK ===========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth to verify JWT
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify JWT and get user claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No user ID in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for operations (after auth check)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========== PERMISSION CHECK ===========
    // Fetch the order to verify ownership/permissions
    const { data: order, error: orderFetchError } = await supabase
      .from('sales_orders')
      .select('id, user_id, organization_id')
      .eq('id', orderId)
      .single();

    if (orderFetchError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is the owner
    let hasPermission = order.user_id === userId;

    // If not owner, check if user is admin/gestor of the organization
    if (!hasPermission && order.organization_id) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', order.organization_id)
        .single();

      // Allow admin and gestor roles to delete orders
      if (membership && (membership.role === 'admin' || membership.role === 'gestor')) {
        hasPermission = true;
      }
    }

    // Also check if user is superadmin
    if (!hasPermission) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (userRoles?.some(r => r.role === 'superadmin')) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have permission to delete this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========== DELETION (only after permission verified) ===========
    console.log(`User ${userId} deleting sales order: ${orderId}`);

    // Delete items first
    const { error: itemsError } = await supabase
      .from('sales_order_items')
      .delete()
      .eq('sales_order_id', orderId);

    if (itemsError) {
      console.error('Error deleting items:', itemsError);
      throw itemsError;
    }

    // Delete additionals
    const { error: additionalsError } = await supabase
      .from('sales_order_additionals')
      .delete()
      .eq('sales_order_id', orderId);

    if (additionalsError) {
      console.error('Error deleting additionals:', additionalsError);
      throw additionalsError;
    }

    // Delete the order
    const { error: orderError } = await supabase
      .from('sales_orders')
      .delete()
      .eq('id', orderId);

    if (orderError) {
      console.error('Error deleting order:', orderError);
      throw orderError;
    }

    console.log(`Successfully deleted order ${orderId} by user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Order deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
