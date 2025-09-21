import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    const { token } = await req.json();
    
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const testResults: any = {};

    // Test 1: Auth endpoint (ya sabemos que funciona)
    try {
      const authResponse = await fetch("https://api.easyquote.cloud/api/v1/users/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test", password: "test" }),
      });
      testResults.auth_endpoint = {
        status: authResponse.status,
        accessible: true,
        message: `Auth endpoint accessible (${authResponse.status})`
      };
    } catch (error) {
      testResults.auth_endpoint = {
        accessible: false,
        error: error.message
      };
    }

    // Test 2: Products endpoint
    try {
      const productsResponse = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
        },
      });
      testResults.products_endpoint = {
        status: productsResponse.status,
        accessible: productsResponse.status !== 0,
        message: `Products endpoint status: ${productsResponse.status}`
      };
    } catch (error) {
      testResults.products_endpoint = {
        accessible: false,
        error: error.message
      };
    }

    // Test 3: Basic connectivity test
    try {
      const basicResponse = await fetch("https://easyquote.cloud/", {
        method: "HEAD",
      });
      testResults.main_site = {
        status: basicResponse.status,
        accessible: true,
        message: `Main site accessible (${basicResponse.status})`
      };
    } catch (error) {
      testResults.main_site = {
        accessible: false,
        error: error.message
      };
    }

    // Test 4: API base URL
    try {
      const apiBaseResponse = await fetch("https://api.easyquote.cloud/", {
        method: "HEAD",
      });
      testResults.api_base = {
        status: apiBaseResponse.status,
        accessible: true,
        message: `API base accessible (${apiBaseResponse.status})`
      };
    } catch (error) {
      testResults.api_base = {
        accessible: false,
        error: error.message
      };
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      tests: testResults
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("test-easyquote-connectivity: unexpected error", err);
    return new Response(JSON.stringify({ 
      error: "Unexpected error",
      details: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});