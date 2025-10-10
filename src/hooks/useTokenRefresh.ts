import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const useTokenRefresh = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Interceptar errores 401 globalmente
    const handleUnauthorized = async (event: CustomEvent) => {
      const { status, code } = event.detail;
      
      if (status === 401 && code === 'EASYQUOTE_UNAUTHORIZED') {
        // Token de EasyQuote expirado - limpiar y salir
        sessionStorage.removeItem('easyquote_token');
        
        toast({
          title: "Sesión expirada",
          description: "Tu sesión de EasyQuote ha expirado. Cerrando sesión...",
          variant: "destructive",
          duration: 3000,
        });

        // Cerrar sesión de Supabase después de un momento
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/auth');
        }, 1500);
      }
    };

    // Agregar listener para errores de autorización
    window.addEventListener('unauthorized-request' as any, handleUnauthorized);

    return () => {
      window.removeEventListener('unauthorized-request' as any, handleUnauthorized);
    };
  }, [navigate]);
};

// Función auxiliar para disparar el evento cuando detectemos un 401
export const notifyUnauthorized = (status: number, code?: string) => {
  if (status === 401) {
    window.dispatchEvent(
      new CustomEvent('unauthorized-request', {
        detail: { status, code }
      })
    );
  }
};