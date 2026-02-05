import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function pickFirstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function findUrlInObject(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const stack: unknown[] = [obj];
  const seen = new Set<unknown>();

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);

    for (const v of Object.values(cur as Record<string, unknown>)) {
      if (typeof v === "string") {
        const s = v.trim();
        if (/^https?:\/\//i.test(s)) return s;
      } else if (v && typeof v === "object") {
        stack.push(v);
      }
    }
  }

  return undefined;
}

function base64UrlDecode(input: string): string {
  // base64url -> base64
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bytes = Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function tryExtractSubscriberIdFromEasyQuoteJwt(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    return pickFirstString(
      payload?.SubscriberID,
      payload?.SubscriberId,
      payload?.subscriberId,
      payload?.subscriberID,
    );
  } catch {
    return undefined;
  }
}

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

    const { token, subscriberId, fileId, fileName, downloadUrl } = await req.json();
    
    if (!token || !fileId) {
      return new Response(JSON.stringify({ error: "Missing required parameters", details: "token + fileId son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let finalDownloadUrl = pickFirstString(downloadUrl);
    let finalSubscriberId = pickFirstString(subscriberId);
    let finalFileName = pickFirstString(fileName);

    // Si no llega subscriberId, intentarlo desde el JWT de EasyQuote (claim SubscriberID)
    if (!finalSubscriberId) {
      finalSubscriberId = tryExtractSubscriberIdFromEasyQuoteJwt(token);
    }

    // Si faltan parámetros, intentar resolverlos desde el detalle del excel
    if (!finalDownloadUrl && (!finalSubscriberId || !finalFileName)) {
      const metaUrl = `https://api.easyquote.cloud/api/v1/excelfiles/${fileId}`;
      console.log("easyquote-download-file: Resolving excel metadata", { metaUrl, fileId });

      const metaRes = await fetch(metaUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("easyquote-download-file: Metadata response status:", metaRes.status);
      if (metaRes.ok) {
        const meta = await metaRes.json();
        // Intentar extraer campos típicos
        finalFileName ||= pickFirstString(
          (meta as any)?.fileName,
          (meta as any)?.FileName,
          (meta as any)?.filename,
          (meta as any)?.name,
          (meta as any)?.originalFileName,
        );
        finalSubscriberId ||= pickFirstString(
          (meta as any)?.subscriberId,
          (meta as any)?.subscriberID,
          (meta as any)?.subscriber_id,
          (meta as any)?.SubscriberId,
        );

        // Algunas APIs devuelven un enlace directo
        finalDownloadUrl ||= pickFirstString(
          (meta as any)?.downloadUrl,
          (meta as any)?.DownloadUrl,
          (meta as any)?.fileUrl,
          (meta as any)?.FileUrl,
          (meta as any)?.url,
          (meta as any)?.Url,
        );

        // Último recurso: buscar cualquier URL dentro del objeto
        finalDownloadUrl ||= findUrlInObject(meta);
      } else {
        const metaText = await metaRes.text();
        console.error("easyquote-download-file: Metadata error:", metaText);
      }
    }

    if (!finalDownloadUrl) {
      if (finalSubscriberId && finalFileName) {
        finalDownloadUrl = `https://sheets.easyquote.cloud/${finalSubscriberId}/${fileId}/${finalFileName}`;
      }
    }

    if (!finalDownloadUrl) {
      return new Response(
        JSON.stringify({
          error: "Missing download info",
          details:
            "No se pudo construir el enlace de descarga del Excel (faltan subscriberId/fileName y no se encontró URL en el metadata).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("easyquote-download-file: Downloading from:", finalDownloadUrl);

    const response = await fetch(finalDownloadUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    console.log("easyquote-download-file: Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("easyquote-download-file: EasyQuote API error:", errorText);
      
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

    // Get the file blob
    const blob = await response.blob();
    
    if (blob.size === 0) {
      return new Response(JSON.stringify({ 
        error: "Empty file",
        message: "El archivo está vacío"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("easyquote-download-file: File downloaded, size:", blob.size);

    // Return the file blob with appropriate headers
    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${finalFileName ?? `excel-${fileId}.xlsx`}"`,
      },
    });

  } catch (err) {
    console.error("easyquote-download-file: unexpected error", err);
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
