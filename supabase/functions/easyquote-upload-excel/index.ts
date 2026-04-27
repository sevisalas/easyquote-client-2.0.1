import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  BlobReader,
  BlobWriter,
  ZipReader,
  ZipWriter,
  TextReader,
  TextWriter,
} from "https://esm.sh/@zip.js/zip.js@2.7.52";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Decode a base64url-encoded string (JWT segment).
 */
function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bytes = Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function extractSubscriberIdFromJwt(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return (
      payload?.SubscriberID ??
      payload?.SubscriberId ??
      payload?.subscriberId ??
      payload?.subscriberID ??
      undefined
    );
  } catch {
    return undefined;
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Given a base64-encoded xlsx, replace master references in:
 * 1) externalLinks .rels files
 * 2) worksheet formulas that embed full paths/URLs to [master.xlsx]
 */
async function replaceMasterReferences(
  base64Content: string,
  masterMappings: Array<{
    localName: string; // e.g. "maestro EQ01.xlsx"
    publicUrl: string; // e.g. "https://sheets.easyquote.cloud/sub/id/file.xlsx"
  }>,
): Promise<{ base64: string; replacements: string[] }> {
  if (!masterMappings.length) {
    return { base64: base64Content, replacements: [] };
  }

  const replacements: string[] = [];
  const addReplacement = (value: string) => {
    if (!replacements.includes(value)) replacements.push(value);
  };

  // Decode base64 → binary
  const binaryStr = atob(base64Content);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Read ZIP entries
  const zipReader = new ZipReader(new BlobReader(blob));
  const entries = await zipReader.getEntries();

  const relsEntries = entries.filter(
    (e) =>
      e.filename.includes("externalLinks/_rels/") &&
      e.filename.endsWith(".xml.rels"),
  );
  const worksheetEntries = entries.filter(
    (e) => e.filename.startsWith("xl/worksheets/") && e.filename.endsWith(".xml"),
  );

  if (!relsEntries.length && !worksheetEntries.length) {
    await zipReader.close();
    return { base64: base64Content, replacements: [] };
  }

  const normalizedMappings = masterMappings.map((m) => {
    const decodedName = safeDecodeURIComponent(m.localName).trim();
    const publicFolderUrl =
      m.publicUrl.slice(0, m.publicUrl.lastIndexOf("/") + 1) || m.publicUrl;
    return {
      localName: decodedName,
      normalizedLocalName: decodedName.toLowerCase(),
      publicUrl: m.publicUrl,
      publicFolderUrl,
    };
  });

  // Lookup for .rels replacement by filename
  const relsLookup = new Map<string, string>();
  for (const m of normalizedMappings) {
    relsLookup.set(m.normalizedLocalName, m.publicUrl);
  }

  const modifiedContents = new Map<string, string>();

  // Detect files that already use direct formula references like [maestro.xlsx].
  // In that case we prioritize worksheet formula replacement and skip .rels,
  // because changing .rels has been causing EasyQuote upload 500 for these files.
  let hasDirectFormulaReferences = false;
  for (const wsEntry of worksheetEntries) {
    const writer = new TextWriter();
    const content = await wsEntry.getData!(writer);
    const contentLower = content.toLowerCase();

    const found = normalizedMappings.some((m) => {
      const plain = `[${m.localName}]`.toLowerCase();
      const encoded = `[${encodeURIComponent(m.localName)}]`.toLowerCase();
      return contentLower.includes(plain) || contentLower.includes(encoded);
    });

    if (found) {
      hasDirectFormulaReferences = true;
      break;
    }
  }

  if (hasDirectFormulaReferences) {
    console.log(
      "easyquote-upload-excel: Direct formula references detected; skipping externalLinks .rels replacement",
    );
  } else {
    // 1) Replace in externalLinks .rels
    for (const relsEntry of relsEntries) {
      const writer = new TextWriter();
      const content = await relsEntry.getData!(writer);

      let modified = content;
      let wasModified = false;

      const targetRegex = /Target="([^"]+)"/g;
      let match;
      while ((match = targetRegex.exec(content)) !== null) {
        const target = match[1];
        if (/^https?:\/\//i.test(target)) continue;

        const decoded = safeDecodeURIComponent(target);
        const fileName = decoded.split("/").pop()?.trim() ?? decoded.trim();
        const publicUrl = relsLookup.get(fileName.toLowerCase());

        if (publicUrl) {
          modified = modified.replace(
            `Target="${target}"`,
            `Target="${publicUrl}"`,
          );
          wasModified = true;
          addReplacement(`${fileName} → ${publicUrl}`);
          console.log(
            `easyquote-upload-excel: Replaced external ref: ${fileName} → ${publicUrl}`,
          );
        }
      }

      if (wasModified) {
        modifiedContents.set(relsEntry.filename, modified);
      }
    }
  }

  // 2) Replace in worksheet formulas with direct path/URL references
  // Example:
  // ='https://d.docs.live.net/.../maestros/[maestro EQ01.xlsx]Papeles'!A6
  for (const wsEntry of worksheetEntries) {
    const writer = new TextWriter();
    const content = await wsEntry.getData!(writer);

    let wsReplacementsCount = 0;
    const modified = content.replace(
      /(')([^'<]*?\[([^\]]+)\])/g,
      (fullMatch, quoteMark: string, _pathWithBracket: string, bracketFileName: string) => {
        const normalizedBracketName = safeDecodeURIComponent(bracketFileName)
          .toLowerCase()
          .trim();

        const mapping = normalizedMappings.find((m) => {
          const local = m.normalizedLocalName;
          const encoded = encodeURIComponent(m.localName).toLowerCase();
          return normalizedBracketName === local || normalizedBracketName === encoded;
        });

        if (!mapping) {
          return fullMatch;
        }

        wsReplacementsCount += 1;
        addReplacement(`formula [${mapping.localName}] → ${mapping.publicFolderUrl}`);
        return `${quoteMark}${mapping.publicFolderUrl}[${mapping.localName}]`;
      },
    );

    if (wsReplacementsCount > 0) {
      console.log(
        `easyquote-upload-excel: Replaced ${wsReplacementsCount} formula path(s) in ${wsEntry.filename}`,
      );
      modifiedContents.set(wsEntry.filename, modified);
    }
  }

  await zipReader.close();

  if (!modifiedContents.size) {
    return { base64: base64Content, replacements: [] };
  }

  // Rebuild ZIP with modified entries
  const zipReader2 = new ZipReader(new BlobReader(blob));
  const entries2 = await zipReader2.getEntries();

  const outputBlobWriter = new BlobWriter(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const zipWriter = new ZipWriter(outputBlobWriter);

  for (const entry of entries2) {
    if (entry.directory) {
      await zipWriter.add(entry.filename, undefined as any, { directory: true });
      continue;
    }

    const modifiedContent = modifiedContents.get(entry.filename);
    if (modifiedContent) {
      await zipWriter.add(entry.filename, new TextReader(modifiedContent));
    } else {
      const blobWriter = new BlobWriter();
      const data = await entry.getData!(blobWriter);
      await zipWriter.add(entry.filename, new BlobReader(data));
    }
  }

  await zipWriter.close();
  await zipReader2.close();

  const outputBlob = await outputBlobWriter.getData();
  const arrayBuffer = await outputBlob.arrayBuffer();
  const outputBytes = new Uint8Array(arrayBuffer);

  // Convert back to base64 (safe chunked approach)
  const chunks: string[] = [];
  const chunkSize = 1024;
  for (let i = 0; i < outputBytes.length; i += chunkSize) {
    const chunk = outputBytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  const outputBase64 = btoa(chunks.join(""));

  return { base64: outputBase64, replacements };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { token, fileName, fileContent, associatedMasterFileId, updateFileId } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!fileName || !fileContent) {
      return new Response(
        JSON.stringify({ error: "fileName and fileContent required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("easyquote-upload-excel: Uploading file", {
      fileName,
      contentLength: fileContent.length,
    });

    // ── Master reference replacement ───────────────────────────────────
    // Look up master files from Supabase to build replacement mappings
    let finalFileContent = fileContent;
    let masterReplacements: string[] = [];

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      // Get the auth user to find their org's master files
      const authHeader = req.headers.get("authorization") ?? "";
      const supabaseToken = authHeader.replace("Bearer ", "");

      // Get user from Supabase JWT
      const {
        data: { user },
      } = await sb.auth.getUser(supabaseToken);

      if (user) {
        // Find master files - if a specific master was selected, use only that one
        let mastersQuery = sb
          .from("excel_files")
          .select("file_id, filename, original_filename, local_reference_name")
          .eq("user_id", user.id)
          .eq("is_master", true)
          .not("local_reference_name", "is", null);

        if (associatedMasterFileId) {
          mastersQuery = mastersQuery.eq("file_id", associatedMasterFileId);
        }

        const { data: masters } = await mastersQuery;

        if (masters?.length) {
          // Extract subscriberId from EasyQuote JWT for URL construction
          const subscriberId = extractSubscriberIdFromJwt(token);

          if (subscriberId) {
            const mappings = masters
              .filter((m) => m.local_reference_name)
              .map((m) => ({
                localName: m.local_reference_name!,
                publicUrl: `https://sheets.easyquote.cloud/${encodeURIComponent(subscriberId)}/${encodeURIComponent(m.file_id)}/${encodeURIComponent(m.filename)}`,
              }));

            console.log(
              "easyquote-upload-excel: Master mappings:",
              JSON.stringify(mappings),
            );

            if (mappings.length) {
              const result = await replaceMasterReferences(
                fileContent,
                mappings,
              );
              finalFileContent = result.base64;
              masterReplacements = result.replacements;

              if (result.replacements.length) {
                console.log(
                  "easyquote-upload-excel: Replaced",
                  result.replacements.length,
                  "master references",
                );
              } else {
                console.log(
                  "easyquote-upload-excel: No matching external refs found in file",
                );
              }
            }
          } else {
            console.log(
              "easyquote-upload-excel: Could not extract subscriberId from EasyQuote JWT",
            );
          }
        } else {
          console.log("easyquote-upload-excel: No master files found for user");
        }
      }
    } catch (masterErr) {
      // Don't block the upload if master replacement fails
      console.error(
        "easyquote-upload-excel: Master replacement error (non-blocking):",
        masterErr,
      );
    }

    // ── Upload/Update to EasyQuote API ───────────────────────────────
    async function uploadToEasyQuote(content: string): Promise<Response> {
      const isUpdate = !!updateFileId;
      const url = isUpdate
        ? `https://api.easyquote.cloud/api/v1/excelfiles/${updateFileId}`
        : "https://api.easyquote.cloud/api/v1/excelfiles";
      const method = isUpdate ? "PUT" : "POST";
      console.log(`easyquote-upload-excel: ${method} to ${url}`);
      return fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ FileName: fileName, File: content }),
      });
    }

    let response = await uploadToEasyQuote(finalFileContent);
    console.log("easyquote-upload-excel: Response status:", response.status);

    // Never upload original silently if replacement was expected.
    // If modified upload fails, return the error so user knows replacement didn't apply.

    const responseText = await response.text();
    console.log(
      "easyquote-upload-excel: Response body preview:",
      responseText.substring(0, 500),
    );

    if (!response.ok) {
      console.error(
        "easyquote-upload-excel: EasyQuote API error:",
        responseText,
      );

      let errorMessage = "Error desconocido";
      try {
        const errorData = JSON.parse(responseText);
        if (errorData?.[""]?.errors?.[0]?.errorMessage) {
          errorMessage = errorData[""].errors[0].errorMessage;
        }
      } catch {
        errorMessage = responseText || `Error ${response.status}`;
      }

      return new Response(
        JSON.stringify({
          error: "EasyQuote API error",
          status: response.status,
          message: errorMessage,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { success: true, rawResponse: responseText };
    }

    // Include master replacement info in response
    if (masterReplacements.length) {
      data.masterReplacements = masterReplacements;
    }

    console.log("easyquote-upload-excel: Upload successful");

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("easyquote-upload-excel: unexpected error", err);
    const errorMessage = err instanceof Error ? (err as Error).message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
