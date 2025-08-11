import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Bienvenido | EasyQuote";
  }, []);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <section className="relative px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Logo principal */}
          <div className="mb-8 animate-fade-in">
            <img 
              src="/lovable-uploads/3ff3c1d3-fd0e-4649-9146-6991b081234b.png" 
              alt="EasyQuote Logo"
              className="h-32 w-auto mx-auto mb-6 hover-scale"
            />
          </div>
          
          {/* Título y subtítulo */}
          <div className="mb-12 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Bienvenido a EasyQuote
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              La plataforma más avanzada para crear presupuestos profesionales 
              y gestionar tus clientes de manera eficiente
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in">
            <Button 
              size="lg"
              onClick={() => navigate('/presupuestos/nuevo')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg hover-scale"
            >
              <Plus className="w-5 h-5 mr-2" />
              Crear Presupuesto
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="border-primary text-primary hover:bg-primary/10 px-8 py-4 text-lg hover-scale"
            >
              Ir al Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            ¿Qué puedes hacer con EasyQuote?
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-foreground">Gestión de Clientes</h3>
                <p className="text-muted-foreground mb-6">
                  Organiza y administra toda tu base de datos de clientes en un solo lugar
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/clientes')}
                  className="w-full border-primary text-primary hover:bg-primary/10"
                >
                  Ver Clientes
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-foreground">Presupuestos Inteligentes</h3>
                <p className="text-muted-foreground mb-6">
                  Crea presupuestos profesionales conectados con la API de EasyQuote
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/presupuestos')}
                  className="w-full border-secondary text-secondary hover:bg-secondary/10"
                >
                  Ver Presupuestos
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale md:col-span-2 lg:col-span-1">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-foreground">Fácil y Rápido</h3>
                <p className="text-muted-foreground mb-6">
                  Interfaz intuitiva que te permite trabajar de manera eficiente
                </p>
                <Button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Empezar Ahora
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Partners/Logos Section */}
      <section className="px-6 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl font-semibold mb-8 text-foreground">Potenciado por</h3>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-70 hover:opacity-100 transition-opacity">
            <img 
              src="/lovable-uploads/6b895d66-5fd4-4be7-b9b7-6b22e2b14c75.png" 
              alt="Partner Logo"
              className="h-16 w-auto hover-scale"
            />
            <img 
              src="/lovable-uploads/90590fde-3895-4073-bd6a-2744ba8ceb02.png" 
              alt="Technology Logo"
              className="h-16 w-auto hover-scale"
            />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-3xl font-bold mb-4 text-foreground">
            ¿Listo para comenzar?
          </h3>
          <p className="text-lg text-muted-foreground mb-8">
            Únete a miles de profesionales que ya confían en EasyQuote
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/presupuestos/nuevo')}
            className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white px-12 py-4 text-lg hover-scale"
          >
            Crear Mi Primer Presupuesto
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
