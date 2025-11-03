import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useSessionMonitor = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Interceptar errores de Supabase
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Clonar la respuesta para poder leer el body múltiples veces
      const clonedResponse = response.clone();
      
      // Solo verificar respuestas de Supabase
      if (args[0]?.toString().includes('supabase.co')) {
        try {
          const data = await clonedResponse.json();
          
          // Detectar errores de sesión
          if (data?.code === 'session_not_found' || 
              data?.message?.includes('JWT') || 
              data?.message?.includes('session') ||
              response.status === 401) {
            
            // Limpiar sesión local
            await supabase.auth.signOut({ scope: 'local' });
            sessionStorage.removeItem('easyquote_token');
            
            // Mostrar mensaje y redirigir
            toast({
              title: "Sesión expirada",
              description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
              variant: "destructive",
            });
            
            navigate('/auth');
          }
        } catch (e) {
          // Si no es JSON o hay error al parsear, ignorar
        }
      }
      
      return response;
    };

    // Limpiar al desmontar
    return () => {
      window.fetch = originalFetch;
    };
  }, [navigate]);
};
