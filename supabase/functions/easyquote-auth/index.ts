import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

    const token = data?.token;
    if (!token) {
      console.error("easyquote-auth: token not present", data);
      return new Response(JSON.stringify({ error: "Token not returned by EasyQuote" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ token }), {
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
