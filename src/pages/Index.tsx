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


  // Obtener estadísticas rápidas
  const { data: stats } = useQuery({
    queryKey: ["quick-stats", userId],
    queryFn: async () => {
      if (!userId) return { total: 0, pending: 0, approved: 0 };
      const { data, error } = await supabase
        .from('quotes')
        .select('status')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return {
        total: data?.length ?? 0,
        pending: data?.filter(q => q.status === 'draft' || q.status === 'sent').length ?? 0,
        approved: data?.filter(q => q.status === 'approved').length ?? 0,
      };
    },
    enabled: !!userId,
  });

  // Si es superadmin, mostrar el dashboard específico de superadmin
  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
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
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                Bienvenido, <span className="text-primary font-bold">{userName}</span>
              </h1>
              <p className="text-muted-foreground mt-1">Gestiona tus presupuestos de forma profesional</p>
            </div>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-primary/20 hover:border-primary/40 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Presupuestos</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.total ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 hover:border-blue-500/40 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pendientes</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.pending ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 hover:border-green-500/40 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Aprobados</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.approved ?? 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
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

