import { supabase } from '@/integrations/supabase/client';
import { notifyUnauthorized } from '@/hooks/useTokenRefresh';

/**
 * Verifica si un token JWT de EasyQuote es válido y no ha expirado
 */
function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    // Add 5 minute buffer before expiration
    return now < (expirationTime - 5 * 60 * 1000);
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
}

/**
 * Intenta refrescar el token de EasyQuote automáticamente
 */
async function refreshEasyQuoteToken(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Usar credenciales de la organización (owner o propias)
    const { data: credentials, error: credError } = await supabase.rpc('get_organization_easyquote_credentials', {
      p_user_id: user.id
    });

    if (credError || !credentials || credentials.length === 0) {
      return null;
    }

    const cred = credentials[0];
    if (!cred.api_username || !cred.api_password) {
      return null;
    }

    const { data, error } = await supabase.functions.invoke('easyquote-auth', {
      body: {
        email: cred.api_username,
        password: cred.api_password
      }
    });

    if (error || !data?.token) {
      return null;
    }

    sessionStorage.setItem('easyquote_token', data.token);
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('easyquote-token-updated'));
    return data.token;
  } catch (err) {
    console.error('Error refreshing EasyQuote token:', err);
    return null;
  }
}

/**
 * Wrapper para invocar edge functions de EasyQuote con manejo automático de errores 401
 * y refresh automático de tokens
 */
export async function invokeEasyQuoteFunction<T = any>(
  functionName: string,
  body: any,
  retryCount = 0
): Promise<{ data: T | null; error: any }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    
    // Verificar si hay un error 401 de EasyQuote
    const is401Error = 
      (error && ((error as any).status === 401 || (error as any).code === 'EASYQUOTE_UNAUTHORIZED')) ||
      (data && typeof data === 'object' && ((data as any).status === 401 || (data as any).code === 'EASYQUOTE_UNAUTHORIZED'));

    if (is401Error && retryCount === 0) {
      // Intentar refrescar el token automáticamente
      const newToken = await refreshEasyQuoteToken();
      
      if (newToken && body.token) {
        // Reintentar con el nuevo token
        const updatedBody = { ...body, token: newToken };
        return invokeEasyQuoteFunction<T>(functionName, updatedBody, 1);
      }
      
      // Si no se pudo refrescar, notificar para logout
      notifyUnauthorized(401, 'EASYQUOTE_UNAUTHORIZED');
      return { data: null, error: { message: 'Sesión expirada' } };
    }
    
    if (error) {
      return { data: null, error };
    }
    
    // Verificar error en data (sin retry)
    if (data && typeof data === 'object' && ((data as any).status === 401 || (data as any).code === 'EASYQUOTE_UNAUTHORIZED')) {
      if (retryCount === 0) {
        notifyUnauthorized(401, 'EASYQUOTE_UNAUTHORIZED');
      }
      return { data: null, error: { message: (data as any).error || 'Sesión expirada' } };
    }
    
    return { data: data as T, error: null };
  } catch (err) {
    console.error(`Error invoking ${functionName}:`, err);
    return { data: null, error: err };
  }
}

/**
 * Obtiene el token de EasyQuote, refrescándolo si es necesario o ha expirado
 */
export async function getEasyQuoteToken(): Promise<string | null> {
  let token = sessionStorage.getItem('easyquote_token');
  
  // Si hay token, verificar si es válido
  if (token) {
    if (isTokenValid(token)) {
      return token;
    }
    // Token expirado o inválido, intentar refrescar
    console.log('EasyQuote token expired or invalid, refreshing...');
  }
  
  // Intentar obtener uno nuevo
  token = await refreshEasyQuoteToken();
  
  return token;
}
