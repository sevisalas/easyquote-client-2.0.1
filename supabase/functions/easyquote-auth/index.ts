import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========== SUPABASE AUTH CHECK ===========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // =========== END AUTH CHECK ===========

    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginUrl = `https://api.easyquote.cloud/api/v1/users/authenticate`;
    const loginRes = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const text = await loginRes.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("easyquote-auth: JSON parse error", e, text);
      return new Response(JSON.stringify({ error: "Invalid response from EasyQuote" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!loginRes.ok) {
      console.error("easyquote-auth: login failed", loginRes.status, data);
      return new Response(JSON.stringify({ error: data?.message || "Authentication failed" }), {
        status: loginRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eqToken = data?.token;
    if (!eqToken) {
      console.error("easyquote-auth: token not present", data);
      return new Response(JSON.stringify({ error: "Token not returned by EasyQuote" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update subscriber plan to "Advance" (highest limits) so all restrictions are handled in the app
    try {
      const tokenParts = eqToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        const subscriberId = payload.SubscriberID;
        
        if (subscriberId) {
          const updateUrl = `https://api.easyquote.cloud/api/v1/subscribers/${subscriberId}`;
          const updateRes = await fetch(updateUrl, {
            method: "PUT",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${eqToken}`
            },
            body: JSON.stringify({ 
              planId: "4c342046-9ac1-449a-9d1d-f59c417e1985"
            }),
          });
          
          if (updateRes.ok) {
            console.log("easyquote-auth: subscriber plan updated to Advance");
          } else {
            console.warn("easyquote-auth: could not update subscriber plan", await updateRes.text());
          }
        }
      }
    } catch (planUpdateErr) {
      console.warn("easyquote-auth: plan update error (non-fatal)", planUpdateErr);
    }

    return new Response(JSON.stringify({ token: eqToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("easyquote-auth: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
