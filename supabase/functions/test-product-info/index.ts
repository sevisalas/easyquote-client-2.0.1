import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { productName = "Booklets" } = await req.json();

    // Get user credentials
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get EasyQuote credentials
    const { data: credentials } = await supabase.rpc('get_user_credentials', {
      p_user_id: user.id
    });

    if (!credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ error: "No EasyQuote credentials found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { api_username, api_password } = credentials[0];

    // Get EasyQuote token
    const authResponse = await fetch('https://api.easyquote.cloud/api/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: api_username,
        password: api_password
      })
    });

    if (!authResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to authenticate with EasyQuote" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token: easyquoteToken } = await authResponse.json();

    // Get products list
    const productsResponse = await fetch('https://api.easyquote.cloud/api/v1/products?isActive=true', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${easyquoteToken}`,
        'Accept': 'application/json'
      }
    });

    const products = await productsResponse.json();
    const product = products.find((p: any) => p.productName === productName);

    if (!product) {
      return new Response(JSON.stringify({ error: `Product ${productName} not found` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pricing info with default values (empty inputs)
    const pricingResponse = await fetch(`https://api.easyquote.cloud/api/v1/pricing/${product.productId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${easyquoteToken}`,
        'Accept': 'application/json'
      }
    });

    const pricingData = await pricingResponse.json();

    // Filter only Price type outputs
    const priceOutputs = pricingData.outputs?.filter((output: any) => output.type === "Price") || [];

    const result = {
      productName: product.productName,
      productId: product.productId,
      prompts: pricingData.prompts || [],
      priceOutputs: priceOutputs,
      finalPrice: priceOutputs.find((o: any) => o.name === "Total" || o.name.includes("Price"))?.value || null,
      fullOutputs: pricingData.outputs // Para debug
    };

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
