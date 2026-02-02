import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify auth
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is superadmin
    const { data: roleData } = await supabaseAnon.rpc('is_superadmin');
    const isSuperAdmin = roleData === true;

    // Use service role to query with join to auth.users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabaseAdmin
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // If not superadmin, only show user's own requests
    if (!isSuperAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data: requests, error: queryError } = await query;

    if (queryError) {
      throw queryError;
    }

    // Get user emails for all requests (only for superadmin)
    if (isSuperAdmin && requests && requests.length > 0) {
      const userIds = [...new Set(requests.map(r => r.user_id))];
      
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      
      const userEmailMap = new Map<string, string>();
      users?.users?.forEach(u => {
        userEmailMap.set(u.id, u.email || '');
      });

      // Add email to each request
      const requestsWithEmail = requests.map(r => ({
        ...r,
        user_email: userEmailMap.get(r.user_id) || null
      }));

      return new Response(JSON.stringify(requestsWithEmail), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(requests), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error fetching support requests:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
