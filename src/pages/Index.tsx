import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import SuperAdminDashboard from "./SuperAdminDashboard";

const Index = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const { isSuperAdmin } = useSubscription();
  const { isHoldedActive } = useHoldedIntegration();

  useEffect(() => {
    document.title = "Inicio | EasyQuote";

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to get profile data first
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single();
        
        if (profile?.first_name) {
          setUserName(profile.first_name);
        } else {
          // Fallback to email prefix if no profile
          setUserName(user.email?.split('@')[0] || 'Usuario');
        }
      }
    };

    getUser();
  }, []);

  // Si es superadmin, mostrar el dashboard específico de superadmin
  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-secondary/5 via-background to-secondary/10 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Primera fila: logo + saludo + botones a la izquierda, imagen a la derecha */}
        <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
          {/* Bloque del logo y saludo */}
          <div className="text-center md:text-left">
            <img
              src="/lovable-uploads/logo_transparente.png"
              alt="EasyQuote Logo"
              className="h-16 w-auto mx-auto md:mx-0 mb-4 hover-scale"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent mb-6">
              Hola, {userName || 'Usuario'}
            </h1>

            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button
                size="lg"
                onClick={() => navigate('/presupuestos/nuevo')}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-8 py-3 text-lg hover-scale"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nuevo Presupuesto
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-secondary text-secondary hover:bg-secondary/10 px-8 py-3 text-lg hover-scale"
              >
                Ver Dashboard
              </Button>
            </div>
          </div>

          {/* Bloque de la imagen */}
          <div className="flex justify-center">
            <img
              src="/lovable-uploads/easyquote 1.png"
              alt="EasyQuote Logo"
              className="h-40 w-auto hover-scale"
            />
          </div>
        </div>

        {/* Segunda fila: tarjetas de Presupuestos y Clientes */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3 text-foreground">Presupuestos</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Crea y gestiona tus presupuestos
              </p>
              <Button
                onClick={() => navigate('/presupuestos')}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Ver Todos
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3 text-foreground">Clientes</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Gestiona tu base de datos de clientes
              </p>
              <Button
                onClick={() => navigate('/clientes')}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Administrar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;

