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

    const { token, productId, inputs } = await req.json();
    console.log("easyquote-pricing: Request received", { productId, inputsCount: Array.isArray(inputs) ? inputs.length : (inputs ? Object.keys(inputs).length : 0) });
    if (!token || !productId) {
      return new Response(JSON.stringify({ error: "Missing token or productId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build target URL
    const baseUrl = `https://api.easyquote.cloud/api/v1/pricing/${productId}`;

    // Prefer POST with JSON body when inputs are provided; fallback to GET with query if POST fails
    let res: Response | null = null;

    // Prepare inputs as an array of { id, value }
    let inputsList: any[] = [];
    if (Array.isArray(inputs)) {
      inputsList = inputs as any[];
    } else if (inputs && typeof inputs === "object" && Object.keys(inputs).length > 0) {
      inputsList = Object.entries(inputs).map(([id, value]) => ({ id, value }));
    }

    if (inputsList.length > 0) {
      try {
        console.log("easyquote-pricing: using PATCH with inputs", { count: inputsList.length });
        res = await fetch(baseUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(inputsList),
        });
      } catch (e) {
        console.error("easyquote-pricing: PATCH attempt failed, will try POST", e);
        try {
          res = await fetch(baseUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(inputsList),
          });
        } catch (e2) {
          console.error("easyquote-pricing: POST attempt failed, will try GET", e2);
        }
      }
    }

    if (!res || !res.ok) {
      const query = inputs && typeof inputs === "object" && Object.keys(inputs).length > 0
        ? `?inputs=${encodeURIComponent(JSON.stringify(inputs))}`
        : "";
      const url = `${baseUrl}${query}`;
      console.log("easyquote-pricing: using GET", { url });
      res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
    }

    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("easyquote-pricing: JSON parse error", e, text);
      return new Response(JSON.stringify({ error: "Invalid response from EasyQuote" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!res.ok) {
      console.error("easyquote-pricing: fetch failed", res.status, data);
      console.error("easyquote-pricing: full response", { 
        status: res.status, 
        statusText: res.statusText, 
        url: res.url,
        productId,
        data 
      });
      return new Response(JSON.stringify({ error: data?.message || "Failed to fetch pricing" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("easyquote-pricing: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
