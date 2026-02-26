import { supabase } from "@/integrations/supabase/client";
import { notifyUnauthorized } from "@/hooks/useTokenRefresh";

/**
 * Verifica si un token JWT de EasyQuote es válido y no ha expirado
 */
function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expirationTime = payload.exp * 1000; // ms
    const now = Date.now();
    // Buffer de 5 min
    return now < (expirationTime - 5 * 60 * 1000);
  } catch (error) {
    console.error("Error validating token:", error);
    return false;
  }
}

/**
 * Intenta refrescar el token de EasyQuote automáticamente usando la edge function segura
 * La edge function obtiene las credenciales server-side y solo devuelve el token
 */
async function refreshEasyQuoteToken(): Promise<string | null> {
  try {
    console.log("[EasyQuote] Starting secure token refresh via edge function...");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[EasyQuote] No user found");
      return null;
    }
    console.log("[EasyQuote] User ID:", user.id);

    const orgId = sessionStorage.getItem('selected_organization_id');
    const { data, error } = await supabase.functions.invoke("easyquote-refresh-token", {
      body: orgId ? { organization_id: orgId } : {},
    });

    if (error) {
      console.error("[EasyQuote] Token refresh failed:", error);
      return null;
    }

    if (!data?.token) {
      console.error("[EasyQuote] No token in response:", data);
      return null;
    }

    console.log("[EasyQuote] Token refresh successful");
    sessionStorage.setItem("easyquote_token", data.token);
    window.dispatchEvent(new Event("easyquote-token-updated"));
    return data.token;
  } catch (err) {
    console.error("[EasyQuote] Error refreshing token:", err);
    return null;
  }
}

function normalizeInvokeError(err: any) {
  // Handle FunctionsHttpError from Supabase client
  // The error context contains the response body with our custom error message
  const context = err?.context;

  let body: any = null;
  
  // Try to get body from different possible locations
  if (context?.body) {
    body = context.body;
  } else if (context?.data) {
    body = context.data;
  } else if (err?.data) {
    body = err.data;
  }
  
  // Parse body if it's a string
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = { raw: body };
    }
  }

  // Extract status from multiple possible locations
  const status = body?.status ?? context?.status ?? err?.status ?? 500;
  const code = body?.code ?? err?.code;
  
  // Priority order for error message:
  // 1. Our custom error message from the edge function body
  // 2. Error from context
  // 3. Generic message from err
  // 4. Fallback
  let message = "Error en la edge function";
  
  if (body?.error && typeof body.error === "string") {
    message = body.error;
  } else if (body?.message && typeof body.message === "string") {
    message = body.message;
  } else if (context?.error && typeof context.error === "string") {
    message = context.error;
  } else if (err?.message && typeof err.message === "string" && !err.message.includes("non-2xx")) {
    message = err.message;
  }

  console.log("[EasyQuote] Normalized error:", { status, code, message, bodyKeys: body ? Object.keys(body) : [] });

  return {
    status,
    code,
    message,
    details: body && typeof body === "object" && Object.keys(body).length ? body : undefined,
  };
}

/**
 * Wrapper para invocar edge functions de EasyQuote con manejo automático de errores 401
 * y refresh automático de tokens
 */
export async function invokeEasyQuoteFunction<T = any>(
  functionName: string,
  body: any,
  retryCount = 0,
): Promise<{ data: T | null; error: any }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });

    // Check if data contains an error field (edge function returned 200 with error)
    if (data && typeof data === "object" && data.isApiError) {
      console.log("[EasyQuote] API error in response:", data.error);
      return { 
        data: null, 
        error: { 
          message: data.error, 
          status: data.errorCode, 
          code: data.code,
          details: data.details 
        } 
      };
    }

    const is401Error =
      (error && ((error as any).status === 401 || (error as any).code === "EASYQUOTE_UNAUTHORIZED")) ||
      (data && typeof data === "object" && ((data as any).status === 401 || (data as any).code === "EASYQUOTE_UNAUTHORIZED"));

    if (is401Error && retryCount === 0) {
      const newToken = await refreshEasyQuoteToken();

      if (newToken && body?.token) {
        const updatedBody = { ...body, token: newToken };
        return invokeEasyQuoteFunction<T>(functionName, updatedBody, 1);
      }

      notifyUnauthorized(401, "EASYQUOTE_UNAUTHORIZED");
      return { data: null, error: { message: "Sesión expirada" } };
    }

    if (error) {
      return { data: null, error: normalizeInvokeError(error) };
    }

    // Error en data (sin retry)
    if (data && typeof data === "object" && ((data as any).status === 401 || (data as any).code === "EASYQUOTE_UNAUTHORIZED")) {
      if (retryCount === 0) {
        notifyUnauthorized(401, "EASYQUOTE_UNAUTHORIZED");
      }
      return { data: null, error: { message: (data as any).error || "Sesión expirada" } };
    }

    return { data: data as T, error: null };
  } catch (err) {
    console.error(`Error invoking ${functionName}:`, err);
    return { data: null, error: normalizeInvokeError(err) };
  }
}

/**
 * Obtiene el token de EasyQuote, refrescándolo si es necesario o ha expirado
 */
export async function getEasyQuoteToken(): Promise<string | null> {
  let token = sessionStorage.getItem("easyquote_token");

  if (token) {
    if (isTokenValid(token)) return token;
    console.log("EasyQuote token expired or invalid, refreshing...");
  }

  token = await refreshEasyQuoteToken();
  return token;
}
