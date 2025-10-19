import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Users, TrendingUp, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import SuperAdminDashboard from "./SuperAdminDashboard";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const { isSuperAdmin } = useSubscription();

  useEffect(() => {
    document.title = "Inicio | EasyQuote";

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single();
        
        if (profile?.first_name) {
          setUserName(profile.first_name);
        } else {
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
    <div className="w-full min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center justify-end gap-4 mb-6">
            <div className="text-right">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                Bienvenido, <span className="text-primary font-bold">{userName}</span>
              </h1>
              <p className="text-muted-foreground mt-1">Gestiona tus presupuestos de forma profesional</p>
            </div>
            <img
              src="/lovable-uploads/logo_transparente-removebg-preview.png"
              alt="EasyQuote"
              className="h-12 w-auto"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallbackApplied) {
                  img.src = '/lovable-uploads/logo_transparente.png';
                  img.dataset.fallbackApplied = 'true';
                }
              }}
            />
          </div>

          {/* Acción Principal */}
          <Button
            size="lg"
            onClick={() => navigate('/presupuestos/nuevo')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5 mr-2" />
            Crear Nuevo Presupuesto
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer" onClick={() => navigate('/presupuestos')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Gestionar Presupuestos</h3>
              <p className="text-sm text-muted-foreground">
                Ver, editar y administrar todos tus presupuestos
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer" onClick={() => navigate('/clientes')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Gestionar Clientes</h3>
              <p className="text-sm text-muted-foreground">
                Administra tu cartera de clientes
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;

