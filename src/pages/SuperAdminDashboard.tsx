import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Network, BarChart3, Kanban, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import RealMetricsDashboard from "@/components/superadmin/RealMetricsDashboard";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useSubscription();
  const [stats, setStats] = useState({
    totalPlans: 0,
    totalOrganizations: 0,
    totalIntegrations: 0
  });

  useEffect(() => {
    document.title = "Dashboard SuperAdmin | EasyQuote";
    
    if (!isSuperAdmin) {
      navigate('/');
      return;
    }

    loadStats();
  }, [isSuperAdmin, navigate]);

  const loadStats = async () => {
    try {
      // Total planes
      const { count: plansCount } = await supabase
        .from('plan_configurations')
        .select('*', { count: 'exact', head: true });

      // Total organizaciones
      const { count: orgsCount } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true });

      // Total accesos a integraciones
      const { count: integrationsCount } = await supabase
        .from('organization_integration_access')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalPlans: plansCount || 0,
        totalOrganizations: orgsCount || 0,
        totalIntegrations: integrationsCount || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-secondary/5 via-background to-secondary/10 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent mb-2">
            Panel de SuperAdmin
          </h1>
          <p className="text-muted-foreground text-lg">
            Administra planes, suscriptores e integraciones del sistema
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Planes</p>
                  <p className="text-3xl font-bold text-primary">{stats.totalPlans}</p>
                </div>
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Suscriptores</p>
                  <p className="text-3xl font-bold text-primary">{stats.totalOrganizations}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>


          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Integraciones Activas</p>
                  <p className="text-3xl font-bold text-primary">{stats.totalIntegrations}</p>
                </div>
                <Network className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Métricas del Sistema */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Métricas del Sistema
          </h2>
          <RealMetricsDashboard />
        </div>

        {/* Acciones principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Planes
              </CardTitle>
              <CardDescription>
                Gestiona los planes de suscripción
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <Button
                onClick={() => navigate('/planes')}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Gestionar planes
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Suscriptores
              </CardTitle>
              <CardDescription>
                Gestiona suscriptores
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <Button
                onClick={() => navigate('/usuarios')}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Gestionar suscriptores
              </Button>
            </CardContent>
          </Card>


          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" />
                Integraciones
              </CardTitle>
              <CardDescription>
                Controla el acceso a integraciones
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <Button
                onClick={() => navigate('/integraciones-acceso')}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Gestionar integraciones
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                SuperAdmins
              </CardTitle>
              <CardDescription>
                Administra los usuarios del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <Button
                onClick={() => navigate('/superadmin/usuarios')}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Gestionar SuperAdmins
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Kanban className="h-5 w-5 text-primary" />
                Roadmap
              </CardTitle>
              <CardDescription>
                Gestiona el backlog de desarrollo
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <Button
                onClick={() => navigate('/superadmin/roadmap')}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Ver Roadmap
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-all duration-300 hover-scale flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Solicitudes
              </CardTitle>
              <CardDescription>
                Gestiona las solicitudes de soporte
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-end">
              <Button
                onClick={() => navigate('/superadmin/solicitudes')}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Ver solicitudes
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;