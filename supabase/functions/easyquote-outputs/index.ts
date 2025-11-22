import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
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

    const { token, productId } = await req.json();
    
    if (!token || !productId) {
      return new Response(JSON.stringify({ error: "Token and productId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("easyquote-outputs: Fetching outputs for product:", productId);

    const response = await fetch(`https://api.easyquote.cloud/api/v1/products/outputs/list/${productId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("easyquote-outputs: Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("easyquote-outputs: EasyQuote API error:", errorText);
      
      if (response.status === 401) {
        return new Response(JSON.stringify({ 
          error: "Unauthorized",
          code: "EASYQUOTE_UNAUTHORIZED",
          message: "Token de EasyQuote inválido o expirado"
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        error: "EasyQuote API error",
        status: response.status,
        message: errorText
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("easyquote-outputs: Outputs received:", data?.length || 0);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("easyquote-outputs: unexpected error", err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ 
      error: "Unexpected error",
      details: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
