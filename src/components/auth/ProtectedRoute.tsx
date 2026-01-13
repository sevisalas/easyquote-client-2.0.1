import { ReactNode, useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const hasCheckedSession = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Función para verificar la sesión inicial
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.error("ProtectedRoute: Error getting session:", error);
          setIsAuthed(false);
          setLoading(false);
          return;
        }

        setIsAuthed(!!session);
        hasCheckedSession.current = true;
      } catch (e) {
        console.error("ProtectedRoute: Unexpected error:", e);
        if (isMounted) {
          setIsAuthed(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Configurar listener para cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      console.log("ProtectedRoute: Auth state changed:", event);
      
      // Solo actualizar después de la verificación inicial para evitar race conditions
      if (hasCheckedSession.current) {
        setIsAuthed(!!session);
        
        // Si se cierra sesión, asegurar que no queda en loading
        if (event === 'SIGNED_OUT') {
          setLoading(false);
        }
      }
    });

    // Verificar sesión inicial
    checkSession();

    // Timeout de seguridad para evitar loading infinito
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("ProtectedRoute: Loading timeout, forcing check");
        setLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
