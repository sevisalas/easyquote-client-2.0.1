import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export const useTokenRefresh = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Interceptar errores 401 globalmente
    const handleUnauthorized = (event: CustomEvent) => {
      const { status, url } = event.detail;
      
      if (status === 401 && url?.includes('easyquote.cloud')) {
        // Token de EasyQuote expirado
        localStorage.removeItem('easyquote_token');
        
        toast({
          title: "Sesión expirada",
          description: "Tu token de EasyQuote ha expirado. Por favor, vuelve a iniciar sesión.",
          variant: "destructive",
          duration: 8000,
        });

        // Opcional: redirigir a auth después de un tiempo
        setTimeout(() => {
          const shouldRedirect = confirm(
            "¿Quieres ir a la página de login para renovar tu sesión?"
          );
          if (shouldRedirect) {
            navigate('/auth');
          }
        }, 2000);
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
export const notifyUnauthorized = (status: number, url?: string) => {
  if (status === 401) {
    window.dispatchEvent(
      new CustomEvent('unauthorized-request', {
        detail: { status, url }
      })
    );
  }
};