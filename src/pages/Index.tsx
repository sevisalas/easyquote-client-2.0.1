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

  // Obtener últimos presupuestos
  const { data: recentQuotes = [] } = useQuery({
    queryKey: ["recent-quotes", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_id, final_price, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Obtener clientes para mostrar nombres
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  const getCustomerName = (customerId?: string | null) => {
    if (!customerId) return "Sin cliente";
    const customer = customers.find((c: any) => c.id === customerId);
    return customer?.name || "—";
  };

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

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground' },
      sent: { label: 'Enviado', className: 'bg-blue-500/10 text-blue-500' },
      approved: { label: 'Aprobado', className: 'bg-green-500/10 text-green-500' },
      rejected: { label: 'Rechazado', className: 'bg-red-500/10 text-red-500' },
    };
    return badges[status as keyof typeof badges] || badges.draft;
  };

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

        {/* Recent Quotes Section */}
        <Card className="mb-12">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Presupuestos Recientes</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/presupuestos')}
                className="text-primary hover:text-primary/90"
              >
                Ver todos
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {recentQuotes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No tienes presupuestos todavía</p>
                <Button onClick={() => navigate('/presupuestos/nuevo')} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear tu primer presupuesto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuotes.map((quote) => {
                  const badge = getStatusBadge(quote.status);
                  return (
                    <div
                      key={quote.id}
                      onClick={() => navigate(`/presupuestos/${quote.id}`)}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all group"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            #{quote.quote_number}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{getCustomerName(quote.customer_id)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">${quote.final_price?.toFixed(2) || '0.00'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(quote.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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

