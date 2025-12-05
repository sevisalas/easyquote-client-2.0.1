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

    const { token, fileName, fileContent } = await req.json();
    
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!fileName || !fileContent) {
      return new Response(JSON.stringify({ error: "fileName and fileContent required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("easyquote-upload-excel: Uploading file", { fileName, contentLength: fileContent.length });

    const response = await fetch("https://api.easyquote.cloud/api/v1/excelfiles", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName,
        fileContent
      }),
    });

    console.log("easyquote-upload-excel: Response status:", response.status);

    const responseText = await response.text();
    console.log("easyquote-upload-excel: Response body preview:", responseText.substring(0, 500));

    if (!response.ok) {
      console.error("easyquote-upload-excel: EasyQuote API error:", responseText);
      
      let errorMessage = "Error desconocido";
      try {
        const errorData = JSON.parse(responseText);
        if (errorData?.[""]?.errors?.[0]?.errorMessage) {
          errorMessage = errorData[""].errors[0].errorMessage;
        }
      } catch {
        errorMessage = responseText || `Error ${response.status}`;
      }

      return new Response(JSON.stringify({ 
        error: "EasyQuote API error",
        status: response.status,
        message: errorMessage
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { success: true, rawResponse: responseText };
    }

    console.log("easyquote-upload-excel: Upload successful");

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("easyquote-upload-excel: unexpected error", err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: "Unexpected error",
      details: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
