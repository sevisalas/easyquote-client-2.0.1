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

    const { productName, productId } = await req.json();

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

    let targetProductId = productId;
    let targetProductName = productName;

    // Si no se proporciona productId, buscar por nombre
    if (!targetProductId && productName) {
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
      
      targetProductId = product.productId;
      targetProductName = product.productName;
    }

    if (!targetProductId) {
      return new Response(JSON.stringify({ error: "productId or productName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pricing info with default values (empty inputs)
    console.log(`Testing product: ${targetProductName} (${targetProductId})`);
    
    const pricingResponse = await fetch(`https://api.easyquote.cloud/api/v1/pricing/${targetProductId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${easyquoteToken}`,
        'Accept': 'application/json'
      }
    });

    console.log(`Pricing response status: ${pricingResponse.status}`);
    
    // Capturar el texto de respuesta para análisis
    const responseText = await pricingResponse.text();
    console.log(`Response text (first 500 chars): ${responseText.substring(0, 500)}`);

    // Si el servidor devuelve error
    if (!pricingResponse.ok) {
      let errorData: any = {};
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { rawResponse: responseText };
      }

      return new Response(JSON.stringify({
        error: "EasyQuote API Error",
        status: pricingResponse.status,
        statusText: pricingResponse.statusText,
        productId: targetProductId,
        productName: targetProductName,
        errorDetails: errorData,
        diagnostics: {
          message: "El producto tiene una configuración incorrecta en EasyQuote",
          suggestions: [
            "Verificar que todos los prompts tengan valores por defecto válidos",
            "Revisar que las fórmulas de cálculo estén correctamente configuradas",
            "Asegurarse de que no haya dependencias circulares en los prompts",
            "Verificar que los tipos de datos de los prompts sean consistentes"
          ]
        }
      }, null, 2), {
        status: pricingResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parsear datos si todo está bien
    let pricingData: any;
    try {
      pricingData = JSON.parse(responseText);
    } catch (parseError) {
      return new Response(JSON.stringify({
        error: "Failed to parse EasyQuote response",
        productId: targetProductId,
        rawResponse: responseText.substring(0, 1000)
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter only Price type outputs
    const priceOutputs = pricingData.outputs?.filter((output: any) => output.type === "Price") || [];

    const result = {
      productName: targetProductName,
      productId: targetProductId,
      prompts: pricingData.prompts || [],
      priceOutputs: priceOutputs,
      finalPrice: priceOutputs.find((o: any) => o.name === "Total" || o.name.includes("Price"))?.value || null,
      fullOutputs: pricingData.outputs, // Para debug
      promptsCount: pricingData.prompts?.length || 0,
      outputsCount: pricingData.outputs?.length || 0
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
