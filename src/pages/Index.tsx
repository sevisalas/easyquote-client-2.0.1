import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    document.title = "Inicio | EasyQuote";
    
    // Obtener información del usuario
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    
    getUser();
  }, []);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-secondary/5 via-background to-secondary/10">
      {/* Hero Section - Simplificado para clientes */}
      <section className="relative px-6 py-12 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Logo principal - Más pequeño */}
          <div className="mb-4 animate-fade-in">
            <img 
              src="/lovable-uploads/3ff3c1d3-fd0e-4649-9146-6991b081234b.png" 
              alt="EasyQuote Logo"
              className="h-16 w-auto mx-auto mb-3 hover-scale"
            />
          </div>
          
          {/* Título simplificado */}
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
              Bienvenido {userEmail ? userEmail.split('@')[0] : 'Usuario'}
            </h1>
          </div>

          {/* Botones de acción principales */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 animate-fade-in">
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
      </section>

      {/* Acceso rápido - Presupuestos primero - ARRIBA como estaba antes */}
      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-secondary/30 hover:border-secondary/60 transition-all duration-300 hover-scale bg-secondary/5">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-lg font-semibold mb-3 text-foreground">Presupuestos</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Crea y gestiona tus presupuestos
                </p>
                <Button 
                  onClick={() => navigate('/presupuestos')}
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
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
                  variant="outline" 
                  onClick={() => navigate('/clientes')}
                  className="w-full border-primary text-primary hover:bg-primary/10"
                >
                  Administrar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Logos Section - Solo una imagen */}
      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center items-center opacity-80 hover:opacity-100 transition-opacity">
            <img 
              src="/lovable-uploads/90590fde-3895-4073-bd6a-2744ba8ceb02.png" 
              alt="Technology Logo"
              className="h-40 w-auto hover-scale"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
