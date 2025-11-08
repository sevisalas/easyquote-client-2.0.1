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

    console.log(`Deleting sales order: ${orderId}`);

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

    console.log(`Successfully deleted order ${orderId}`);

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