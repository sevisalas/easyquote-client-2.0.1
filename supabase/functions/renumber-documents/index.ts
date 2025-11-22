import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NumberingFormat {
  prefix: string;
  suffix: string | null;
  use_year: boolean;
  year_format: string;
  sequential_digits: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Verify user is superadmin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "superadmin") {
      throw new Error("Only superadmins can renumber documents");
    }

    const { userId, renumberQuotes, renumberOrders, quoteFormat, orderFormat } = await req.json();

    if (!userId) {
      throw new Error("userId is required");
    }

    if (!renumberQuotes && !renumberOrders) {
      throw new Error("At least one document type must be selected");
    }

    // Get organization_id for the user
    const { data: orgData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    const organizationId = orgData?.organization_id;

    // Get all user_ids in the organization
    let userIds = [userId];
    if (organizationId) {
      const { data: members } = await supabaseAdmin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId);
      
      if (members && members.length > 0) {
        userIds = members.map(m => m.user_id);
      }
    }

    let quotesUpdated = 0;
    let ordersUpdated = 0;

    // Renumber quotes
    if (renumberQuotes && quoteFormat) {
      const format = quoteFormat as NumberingFormat;
      const year = new Date().getFullYear();
      const yearStr = format.use_year
        ? (format.year_format === 'YY' ? year.toString().slice(-2) : year.toString())
        : '';
      
      const prefix = format.prefix + (format.use_year ? yearStr + '-' : '');
      const suffix = format.suffix || '';

      // Fetch all quotes from organization ordered by created_at
      const { data: quotes, error: quotesError } = await supabaseAdmin
        .from("quotes")
        .select("id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: true });

      if (quotesError) throw quotesError;

      // Update each quote with new number
      for (let i = 0; i < (quotes?.length || 0); i++) {
        const sequentialNum = (i + 1).toString().padStart(format.sequential_digits, '0');
        const newNumber = `${prefix}${sequentialNum}${suffix}`;

        const { error: updateError } = await supabaseAdmin
          .from("quotes")
          .update({ quote_number: newNumber })
          .eq("id", quotes![i].id);

        if (updateError) {
          console.error(`Error updating quote ${quotes![i].id}:`, updateError);
        } else {
          quotesUpdated++;
        }
      }
    }

    // Renumber orders
    if (renumberOrders && orderFormat) {
      const format = orderFormat as NumberingFormat;
      const year = new Date().getFullYear();
      const yearStr = format.use_year
        ? (format.year_format === 'YY' ? year.toString().slice(-2) : year.toString())
        : '';
      
      const prefix = format.prefix + (format.use_year ? yearStr + '-' : '');
      const suffix = format.suffix || '';

      // Fetch all orders from organization ordered by created_at
      const { data: orders, error: ordersError } = await supabaseAdmin
        .from("sales_orders")
        .select("id, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: true });

      if (ordersError) throw ordersError;

      // Update each order with new number
      for (let i = 0; i < (orders?.length || 0); i++) {
        const sequentialNum = (i + 1).toString().padStart(format.sequential_digits, '0');
        const newNumber = `${prefix}${sequentialNum}${suffix}`;

        const { error: updateError } = await supabaseAdmin
          .from("sales_orders")
          .update({ order_number: newNumber })
          .eq("id", orders![i].id);

        if (updateError) {
          console.error(`Error updating order ${orders![i].id}:`, updateError);
        } else {
          ordersUpdated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        quotesUpdated, 
        ordersUpdated 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in renumber-documents:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
