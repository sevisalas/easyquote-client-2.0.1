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

    const { token, product } = await req.json();
    console.log("easyquote-update-product: Request received", { 
      productId: product?.id, 
      productName: product?.productName,
      isActive: product?.isActive 
    });

    if (!token || !product || !product.id) {
      return new Response(JSON.stringify({ error: "Missing token or product data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usar PUT para actualizar el producto
    const url = `https://api.easyquote.cloud/api/v1/products`;
    
    console.log("easyquote-update-product: Sending PUT request", { 
      url, 
      payload: product 
    });

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(product),
    });

    const text = await res.text();
    let data: any;
    
    try {
      data = text ? JSON.parse(text) : { success: true };
    } catch (e) {
      console.error("easyquote-update-product: JSON parse error", e, text);
      // Si no hay respuesta JSON pero el status es OK, asumimos éxito
      if (res.ok) {
        data = { success: true };
      } else {
        return new Response(JSON.stringify({ error: "Invalid response from EasyQuote" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!res.ok) {
      console.error("easyquote-update-product: Request failed", res.status, data);
      
      // Si es un error 401, retornamos un error específico para que el frontend lo maneje
      if (res.status === 401) {
        return new Response(JSON.stringify({ 
          error: "Tu sesión de EasyQuote ha expirado. Por favor, vuelve a conectarte.", 
          code: "EASYQUOTE_UNAUTHORIZED",
          status: 401 
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: data?.message || "Failed to update product",
        details: data 
      }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("easyquote-update-product: Success");
    
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("easyquote-update-product: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
