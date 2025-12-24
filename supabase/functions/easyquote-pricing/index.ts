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

    const startTime = Date.now();
    const { token, productId, inputs } = await req.json();
    console.log("easyquote-pricing: Request received", { productId, inputsCount: Array.isArray(inputs) ? inputs.length : (inputs ? Object.keys(inputs).length : 0) });
    if (!token || !productId) {
      return new Response(JSON.stringify({ error: "Missing token or productId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Custom products don't use EasyQuote API
    if (productId === "__CUSTOM_PRODUCT__") {
      console.log("easyquote-pricing: Custom product, returning empty response");
      return new Response(JSON.stringify({ prompts: [], outputValues: [], price: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build target URL with cache buster
    const cacheBuster = `_t=${Date.now()}`;
    const baseUrl = `https://api.easyquote.cloud/api/v1/pricing/${productId}?${cacheBuster}`;

    // Prefer POST with JSON body when inputs are provided; fallback to GET with query if POST fails
    let res: Response | null = null;

    // Prepare inputs as an array of { id, value } and filter invalid values
    let inputsList: any[] = [];
    if (Array.isArray(inputs)) {
      inputsList = inputs as any[];
    } else if (inputs && typeof inputs === "object" && Object.keys(inputs).length > 0) {
      inputsList = Object.entries(inputs).map(([id, value]) => ({ id, value }));
    }
    
    // Remove duplicates: prefer UUID IDs over numeric IDs
    // This handles cases where old prompts (numeric IDs) are mixed with new prompts (UUID IDs)
    const seenPromptSequences = new Map<number, any>();
    const filteredInputsList: any[] = [];
    
    for (const input of inputsList) {
      const id = String(input.id);
      
      // Determine if this is a numeric ID or UUID
      const isNumericId = /^\d+$/.test(id);
      const isUuidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isNumericId) {
        // Store numeric ID prompts temporarily
        const sequence = parseInt(id, 10);
        if (!seenPromptSequences.has(sequence)) {
          seenPromptSequences.set(sequence, input);
        }
      } else if (isUuidId) {
        // UUID IDs always take precedence - add them directly and remove any numeric ID at same position
        // We'll add all UUID prompts to the final list
        filteredInputsList.push(input);
      } else {
        // Unknown ID format, keep it
        filteredInputsList.push(input);
      }
    }
    
    // Only add numeric ID prompts if no UUID prompts were found (backward compatibility)
    if (filteredInputsList.length === 0 && seenPromptSequences.size > 0) {
      filteredInputsList.push(...Array.from(seenPromptSequences.values()));
      console.log("easyquote-pricing: Using numeric IDs (legacy mode)");
    } else if (filteredInputsList.length > 0) {
      console.log("easyquote-pricing: Using UUID IDs, discarded", seenPromptSequences.size, "numeric IDs");
    }
    
    inputsList = filteredInputsList;
    
    // Filter out invalid values that could cause EasyQuote API to crash
    inputsList = inputsList.filter(input => {
      const value = input.value;
      
      // Remove null or undefined
      if (value === null || value === undefined) {
        console.log(`⚠️ Filtering out prompt ${input.id}: value is null/undefined`);
        return false;
      }
      
      // For strings, check if it's empty or only contains whitespace/special chars
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
          console.log(`⚠️ Filtering out prompt ${input.id}: empty string`);
          return false;
        }
        // Filter out strings that are only special characters without alphanumeric content
        if (trimmed.length < 3 && /^[^\w\s]+$/.test(trimmed)) {
          console.log(`⚠️ Filtering out prompt ${input.id}: only special characters (${value})`);
          return false;
        }
      }
      
      // For numbers, check if it's valid
      if (typeof value === 'number' && !isFinite(value)) {
        console.log(`⚠️ Filtering out prompt ${input.id}: invalid number`);
        return false;
      }
      
      return true;
    });

    // Convert decimal numbers to strings with comma (Spanish format) for EasyQuote API
    // The API interprets "15.5" as "155" if sent as a number with decimal point
    const formattedInputsList = inputsList.map(input => {
      const value = input.value;
      // If it's a number with decimals, convert to string with comma
      if (typeof value === 'number' && !Number.isInteger(value)) {
        return {
          id: input.id,
          value: value.toString().replace('.', ',')
        };
      }
      return input;
    });

    if (formattedInputsList.length > 0) {
      // API only supports PATCH for sending inputs (no POST exists for pricing)
      console.log("easyquote-pricing: using PATCH with inputs", { count: formattedInputsList.length, inputs: formattedInputsList });
      const apiCallStart = Date.now();
      res = await fetch(baseUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
        body: JSON.stringify(formattedInputsList),
      });
      console.log(`⏱️ easyquote-pricing: API PATCH call took ${Date.now() - apiCallStart}ms`);
    } else {
      // No inputs, try GET first (faster)
      console.log("easyquote-pricing: no inputs, trying GET first");
      const apiCallStart = Date.now();
      res = await fetch(baseUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      });
      console.log(`⏱️ easyquote-pricing: API GET call took ${Date.now() - apiCallStart}ms`);

      const tryPatchWithInputs = async (inputsForPatch: any[], reason: string) => {
        console.log(`easyquote-pricing: retrying with PATCH (${reason})`, {
          count: inputsForPatch.length,
        });
        return await fetch(baseUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
          },
          body: JSON.stringify(inputsForPatch),
        });
      };

      // If GET fails with 500, retry with PATCH (sometimes bypasses server caching issues)
      if (res.status === 500) {
        res = await tryPatchWithInputs([], "empty inputs");
      }

      // If it still fails with 500, try to PATCH using "safe defaults" built from prompt definitions
      if (res.status === 500) {
        try {
          const promptsUrl = `https://api.easyquote.cloud/api/v1/products/prompts/list/${productId}?_t=${Date.now()}`;
          console.log("easyquote-pricing: still 500, fetching prompts to build fallback inputs", {
            promptsUrl,
          });

          const promptsRes = await fetch(promptsUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
            },
          });

          const promptsText = await promptsRes.text();
          const promptsData = promptsText ? JSON.parse(promptsText) : [];
          const promptsList = Array.isArray(promptsData) ? promptsData : (promptsData?.items || promptsData?.data || []);

          const fallbackInputs = (Array.isArray(promptsList) ? promptsList : []).map((p: any) => {
            const id = p.id ?? p.promptId ?? p.prompt_id;
            if (!id) return null;

            // Try common fields for defaults/current values
            let value = p.currentValue ?? p.value ?? p.defaultValue ?? p.default_value ?? p.selectedValue;

            // If still missing, try first option
            if (value === null || value === undefined) {
              const opts = p.valueOptions ?? p.options ?? p.values ?? p.valueoptions;
              if (Array.isArray(opts) && opts.length > 0) {
                const first = opts[0];
                value = first?.value ?? first?.id ?? first?.name ?? first?.label ?? first;
              }
            }

            // Last resort for numeric types
            if (value === null || value === undefined) {
              const t = String(p.promptType ?? p.type ?? "");
              if (t === "Number" || t === "Quantity") value = 1;
            }

            return { id: String(id), value };
          }).filter(Boolean);

          const usableFallbackInputs = (fallbackInputs as any[]).filter((i) => i.value !== null && i.value !== undefined && String(i.value).trim() !== "");

          if (usableFallbackInputs.length > 0) {
            res = await tryPatchWithInputs(usableFallbackInputs, "fallback prompt defaults");
          } else {
            console.log("easyquote-pricing: no usable fallback inputs could be built");
          }
        } catch (e) {
          console.error("easyquote-pricing: fallback prompt-default PATCH failed", e);
        }
      }
    }

    const text = await res.text();
    console.log("easyquote-pricing: raw response", { status: res.status, textLength: text.length, preview: text.substring(0, 500) });
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
      // Log the structure of the response to understand outputs
      console.log("easyquote-pricing: parsed response keys:", Object.keys(data));
      if (data.outputs) {
        console.log("easyquote-pricing: outputs count:", data.outputs.length, "sample:", JSON.stringify(data.outputs.slice(0, 2)));
      }
      if (data.outputValues) {
        console.log("easyquote-pricing: outputValues count:", data.outputValues.length);
        // Log each output's fields to see what's available
        console.log("easyquote-pricing: outputValues DETAILS:", JSON.stringify(data.outputValues.map((o: any, i: number) => ({
          idx: i,
          label: o.label || o.name || o.outputText,
          nameCell: o.nameCell,
          valueCell: o.valueCell,
          sheet: o.sheet,
          id: o.id,
          outputId: o.outputId
        }))));
      }
      if (data.priceOutputs) {
        console.log("easyquote-pricing: priceOutputs count:", data.priceOutputs.length);
      }
      if (data.price !== undefined) {
        console.log("easyquote-pricing: price field:", data.price);
      }
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
      
      // Mensaje de error más descriptivo
      const errorMessage = data?.message || data?.error || res.statusText || "Error desconocido";
      const detailedError = res.status === 500 
        ? `Error del servidor de EasyQuote al procesar el producto (${productId}): ${errorMessage}. Por favor, verifica la configuración del producto en EasyQuote.`
        : `Error al obtener precio: ${errorMessage}`;
      
      return new Response(JSON.stringify({ 
        error: detailedError,
        status: res.status,
        productId,
        details: data
      }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ easyquote-pricing: TOTAL request time: ${totalTime}ms`);
    
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
