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

    const { token, includeInactive = false } = await req.json();
    console.log("easyquote-products: Request received", { includeInactive });
    
    if (!token) {
      console.error("easyquote-products: Missing token");
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("easyquote-products: Making request to EasyQuote API", { includeInactive });

    // Si includeInactive es true, no filtramos por isActive
    const url = includeInactive 
      ? `https://api.easyquote.cloud/api/v1/products`
      : `https://api.easyquote.cloud/api/v1/products?isActive=true`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error("easyquote-products: JSON parse error", e, text);
      return new Response(JSON.stringify({ error: "Invalid response from EasyQuote" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!res.ok) {
      console.error("easyquote-products: fetch failed", res.status, data);
      
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
      
      return new Response(JSON.stringify({ error: data?.message || "Failed to fetch products" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process products data
    let products = Array.isArray(data) ? data : (data?.items || data?.data || []);
    console.log(`easyquote-products: Total products received: ${products.length}`);
    
    // Si no queremos incluir inactivos, filtramos solo los activos
    if (!includeInactive) {
      const activeProducts = products.filter((product: any) => {
        console.log(`Product ${product.productName}: isActive=${product.isActive}`);
        return product.isActive === true;
      });
      products = activeProducts;
      console.log(`easyquote-products: Backend filtered ${products.length} active products`);
    } else {
      console.log(`easyquote-products: Returning all products (active and inactive): ${products.length}`);
    }

    return new Response(JSON.stringify(products), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("easyquote-products: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
