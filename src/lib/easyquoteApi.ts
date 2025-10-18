import { supabase } from '@/integrations/supabase/client';
import { notifyUnauthorized } from '@/hooks/useTokenRefresh';

/**
 * Intenta refrescar el token de EasyQuote automáticamente
 */
async function refreshEasyQuoteToken(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: credentials, error: credError } = await supabase.rpc('get_user_credentials', {
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
 * Obtiene el token de EasyQuote, refrescándolo si es necesario
 */
export async function getEasyQuoteToken(): Promise<string | null> {
  let token = sessionStorage.getItem('easyquote_token');
  
  if (!token) {
    // Intentar obtener uno nuevo
    token = await refreshEasyQuoteToken();
  }
  
  return token;
}
