import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select("holded_document_id, user_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order.holded_document_id) {
      return new Response(
        JSON.stringify({ error: "Order not exported to Holded" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's organization (from the authenticated user, not the order creator)
    console.log("User ID:", user.id);
    let organizationId: string | null = null;

    const { data: orgMember, error: orgMemberError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("orgMember:", orgMember, "error:", orgMemberError);

    if (orgMember) {
      organizationId = orgMember.organization_id;
    } else {
      // Try to get organization where user is the owner
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("api_user_id", user.id)
        .maybeSingle();
      
      console.log("org:", org, "error:", orgError);
      
      if (org) {
        organizationId = org.id;
      }
    }

    console.log("Final organizationId:", organizationId);

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Holded API key from environment secret
    const apiKey = Deno.env.get("HOLDED_API_KEY");
    
    if (!apiKey) {
      console.error("HOLDED_API_KEY not found in environment");
      return new Response(
        JSON.stringify({ error: "Holded API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch document from Holded
    const holdedResponse = await fetch(
      `https://api.holded.com/api/invoicing/v1/documents/salesorder/${order.holded_document_id}`,
      {
        method: "GET",
        headers: {
          key: apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!holdedResponse.ok) {
      const errorText = await holdedResponse.text();
      console.error("Holded API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch from Holded" }),
        { status: holdedResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const holdedData = await holdedResponse.json();
    console.log("Holded document data:", holdedData);

    // Update order with the document number
    const { error: updateError } = await supabase
      .from("sales_orders")
      .update({
        holded_document_number: holdedData.invoiceNum || null,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        holdedNumber: holdedData.invoiceNum 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in holded-sync-order-number:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
