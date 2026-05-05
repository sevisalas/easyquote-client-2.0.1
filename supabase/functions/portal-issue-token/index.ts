import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const { data: userRes, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !userRes.user) {
      return new Response(JSON.stringify({ error: "invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const { quote_id } = await req.json();
    if (!quote_id || typeof quote_id !== "string") {
      return new Response(JSON.stringify({ error: "quote_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the quote belongs to a customer linked to this portal user
    const { data: quote, error: qerr } = await admin
      .from("quotes")
      .select("id, status, customer_id")
      .eq("id", quote_id)
      .maybeSingle();
    if (qerr || !quote) {
      return new Response(JSON.stringify({ error: "quote not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (quote.status === "draft") {
      return new Response(JSON.stringify({ error: "draft not accessible" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cust } = await admin
      .from("customers")
      .select("id, portal_user_id")
      .eq("id", quote.customer_id)
      .maybeSingle();
    if (!cust || cust.portal_user_id !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reuse a non-expired token if available
    const { data: existing } = await admin
      .from("quote_portal_tokens")
      .select("token, expires_at")
      .eq("quote_id", quote_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let token: string | null = null;
    if (existing?.token && (!existing.expires_at || new Date(existing.expires_at) > new Date())) {
      token = existing.token;
    } else {
      const { data: created, error: cerr } = await admin
        .from("quote_portal_tokens")
        .insert({ quote_id })
        .select("token")
        .single();
      if (cerr || !created) {
        return new Response(JSON.stringify({ error: "could not create token" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      token = created.token;
    }

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});