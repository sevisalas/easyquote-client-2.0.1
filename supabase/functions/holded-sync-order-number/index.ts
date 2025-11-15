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

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", order.user_id)
      .single();

    if (!orgMember) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Holded access token
    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("name", "Holded")
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ error: "Holded integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: access } = await supabase
      .from("organization_integration_access")
      .select("access_token_encrypted")
      .eq("organization_id", orgMember.organization_id)
      .eq("integration_id", integration.id)
      .eq("is_active", true)
      .single();

    if (!access?.access_token_encrypted) {
      return new Response(
        JSON.stringify({ error: "Holded not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt the access token
    const { data: decryptedToken, error: decryptError } = await supabase.rpc(
      "decrypt_credential",
      { encrypted_data: access.access_token_encrypted }
    );

    if (decryptError || !decryptedToken) {
      return new Response(
        JSON.stringify({ error: "Failed to decrypt Holded token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch document from Holded
    const holdedResponse = await fetch(
      `https://api.holded.com/api/invoicing/v1/documents/salesorder/${order.holded_document_id}`,
      {
        method: "GET",
        headers: {
          key: decryptedToken,
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
