import { supabase } from '@/integrations/supabase/client';
import { notifyUnauthorized } from '@/hooks/useTokenRefresh';

/**
 * Wrapper para invocar edge functions de EasyQuote con manejo automático de errores 401
 */
export async function invokeEasyQuoteFunction<T = any>(
  functionName: string,
  body: any
): Promise<{ data: T | null; error: any }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    
    // Verificar si hay un error 401 de EasyQuote
    if (error) {
      // Si el error tiene información de status 401
      if ((error as any).status === 401 || (error as any).code === 'EASYQUOTE_UNAUTHORIZED') {
        notifyUnauthorized(401, 'EASYQUOTE_UNAUTHORIZED');
      }
      return { data: null, error };
    }
    
    // También verificar si la data contiene información de error 401
    if (data && typeof data === 'object') {
      const dataObj = data as any;
      if (dataObj.status === 401 || dataObj.code === 'EASYQUOTE_UNAUTHORIZED') {
        notifyUnauthorized(401, 'EASYQUOTE_UNAUTHORIZED');
        return { data: null, error: { message: dataObj.error || 'Sesión expirada' } };
      }
    }
    
    return { data: data as T, error: null };
  } catch (err) {
    console.error(`Error invoking ${functionName}:`, err);
    return { data: null, error: err };
  }
}
