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

    const { token, subscriberId, fileId, fileName } = await req.json();
    console.log("easyquote-master-files: Request received", { subscriberId, fileId, fileName });
    
    if (!token || !subscriberId || !fileId || !fileName) {
      return new Response(JSON.stringify({ 
        error: "Missing required parameters: token, subscriberId, fileId, fileName" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Construct the EasyQuote master file URL
    const masterFileUrl = `https://sheets.easyquote.cloud/${subscriberId}/${fileId}/${fileName}`;
    
    console.log("Fetching master file from:", masterFileUrl);

    // Fetch the file with the EasyQuote token
    const fileResponse = await fetch(masterFileUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*"
      },
    });

    if (!fileResponse.ok) {
      console.error("Failed to fetch master file:", fileResponse.status, await fileResponse.text());
      return new Response(JSON.stringify({ 
        error: `Failed to fetch master file: ${fileResponse.status} ${fileResponse.statusText}` 
      }), {
        status: fileResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the file content
    const fileBuffer = await fileResponse.arrayBuffer();
    
    console.log("Successfully fetched master file, size:", fileBuffer.byteLength);

    // Return the file with appropriate headers
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileBuffer.byteLength.toString(),
      },
    });

  } catch (err) {
    console.error("easyquote-master-files: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});