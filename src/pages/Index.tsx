import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Users, TrendingUp, Clock, CheckCircle2, ArrowRight, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import SuperAdminDashboard from "./SuperAdminDashboard";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { QuickActionsPanel } from "@/components/mobile/QuickActionsPanel";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const { isSuperAdmin, isERPSubscription, canAccessProduccion } = useSubscription();
  const isMobile = useIsMobile();

  // Obtener estadísticas rápidas de presupuestos
  const { data: stats } = useQuery({
    queryKey: ["quick-stats"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { total: 0, draft: 0, sent: 0, approved: 0, rejected: 0 };

      // Las políticas RLS se encargan de filtrar según el rol
      // Los admins verán todos los presupuestos de la organización
      const { data, error } = await supabase.from("quotes").select("status");

      if (error) throw error;

      return {
        total: data?.length ?? 0,
        draft: data?.filter((q) => q.status === "draft").length ?? 0,
        sent: data?.filter((q) => q.status === "sent").length ?? 0,
        approved: data?.filter((q) => q.status === "approved").length ?? 0,
        rejected: data?.filter((q) => q.status === "rejected").length ?? 0,
      };
    },
  });

  // Obtener estadísticas de pedidos (solo para usuarios con acceso a producción)
  const { data: orderStats } = useQuery({
    queryKey: ["orders-quick-stats"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { total: 0, draft: 0, pending: 0, production: 0, completed: 0 };

      // Las políticas RLS se encargan de filtrar según el rol
      // Los admins verán todos los pedidos de la organización
      const { data, error } = await supabase.from("sales_orders").select("status");

      if (error) throw error;

      return {
        total: data?.length ?? 0,
        draft: data?.filter((o) => o.status === "draft").length ?? 0,
        pending: data?.filter((o) => o.status === "pending").length ?? 0,
        production: data?.filter((o) => o.status === "in_production").length ?? 0,
        completed: data?.filter((o) => o.status === "completed").length ?? 0,
      };
    },
    enabled: canAccessProduccion(),
  });

  useEffect(() => {
    document.title = "Inicio | EasyQuote";

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);

        // Primero intentar obtener display_name de organization_members
        const { data: member } = await supabase
          .from("organization_members")
          .select("display_name")
          .eq("user_id", user.id)
          .single();

        if (member?.display_name) {
          setUserName(member.display_name);
        } else {
          // Fallback a email si no hay display_name
          setUserName(user.email?.split("@")[0] || "Usuario");
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
      <div className={cn(
        "max-w-7xl mx-auto",
        isMobile ? "px-0" : "px-4 sm:px-6 lg:px-8 py-4 md:py-8"
      )}>
        {/* Hero Section */}
        <div className={cn(
          isMobile ? "mb-4 px-4" : "mb-6 md:mb-12"
        )}>
          <div className="flex flex-col md:flex-row items-center md:justify-between gap-4 mb-6">
            <img
              src="/lovable-uploads/logo_transparente-removebg-preview.png"
              alt="EasyQuote"
              className="h-16 md:h-20 w-auto"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallbackApplied) {
                  img.src = "/lovable-uploads/logo_transparente.png";
                  img.dataset.fallbackApplied = "true";
                }
              }}
            />
            <div className="text-center md:text-right">
              <h1 className="text-lg md:text-2xl font-bold text-foreground">
                Hola, <span className="text-primary font-bold">{userName}</span>
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">Gestiona tus presupuestos y pedidos de forma profesional</p>
            </div>
          </div>

          {/* Acción Principal - Solo mostrar si NO tienen módulo ERP */}
          {!isERPSubscription() && (
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/presupuestos/nuevo")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 md:px-8 py-4 md:py-6 text-base md:text-lg shadow-lg hover:shadow-xl transition-all w-full md:w-auto"
              >
                <Plus className="w-4 md:w-5 h-4 md:h-5 mr-2" />
                Crear nuevo presupuesto
              </Button>
            </div>
          )}
        </div>

        {/* Atajos Rápidos - Solo móvil */}
        {isMobile && <QuickActionsPanel />}

        {/* Stats Cards - Presupuestos */}
        <div className={cn(isMobile ? "px-4" : "")}>
          <div className="mb-4">
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3">Presupuestos</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6 mb-6">
          <Card className="border-primary/20 hover:border-primary/40 transition-all">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground mb-1">Total</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">{stats?.total ?? 0}</p>
                </div>
                <div className="w-8 h-8 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-500/20 hover:border-gray-500/40 transition-all">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground mb-1">Borrador</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">{stats?.draft ?? 0}</p>
                </div>
                <div className="w-8 h-8 md:w-12 md:h-12 bg-gray-500/10 rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 md:w-6 md:h-6 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 hover:border-blue-500/40 transition-all">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground mb-1">Enviado</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">{stats?.sent ?? 0}</p>
                </div>
                <div className="w-8 h-8 md:w-12 md:h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 md:w-6 md:h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 hover:border-green-500/40 transition-all">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground mb-1">Aprobado</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">{stats?.approved ?? 0}</p>
                </div>
                <div className="w-8 h-8 md:w-12 md:h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 hover:border-red-500/40 transition-all">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground mb-1">Rechazado</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">{stats?.rejected ?? 0}</p>
                </div>
                <div className="w-8 h-8 md:w-12 md:h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 md:w-6 md:h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        {/* Stats Cards - Pedidos (solo para usuarios con acceso a producción) */}
        {canAccessProduccion() && (
          <div className={cn(isMobile ? "px-4" : "")}>
            <div className="mb-4 mt-6">
              <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3">Pedidos</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6 mb-6">
              <Card className="border-primary/20 hover:border-primary/40 transition-all">
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground mb-1">Total</p>
                      <p className="text-2xl md:text-3xl font-bold text-foreground">{orderStats?.total ?? 0}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Package className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-500/20 hover:border-gray-500/40 transition-all">
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground mb-1">Borrador</p>
                      <p className="text-2xl md:text-3xl font-bold text-foreground">{orderStats?.draft ?? 0}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-gray-500/10 rounded-full flex items-center justify-center">
                      <FileText className="w-4 h-4 md:w-6 md:h-6 text-gray-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 hover:border-yellow-500/40 transition-all">
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground mb-1">Pendiente</p>
                      <p className="text-2xl md:text-3xl font-bold text-foreground">{orderStats?.pending ?? 0}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 md:w-6 md:h-6 text-yellow-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-500/20 hover:border-blue-500/40 transition-all">
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground mb-1">En producción</p>
                      <p className="text-2xl md:text-3xl font-bold text-foreground">{orderStats?.production ?? 0}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-500/20 hover:border-green-500/40 transition-all">
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground mb-1">Completado</p>
                      <p className="text-2xl md:text-3xl font-bold text-foreground">{orderStats?.completed ?? 0}</p>
                    </div>
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 md:w-6 md:h-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className={cn(isMobile ? "px-4" : "")}>
          <div className={`grid gap-3 md:gap-6 ${canAccessProduccion() ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
          <Card
            className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer"
            onClick={() => navigate("/clientes")}
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2 text-foreground">Gestionar Clientes</h3>
              <p className="text-xs md:text-sm text-muted-foreground">Administra tu cartera de clientes</p>
            </CardContent>
          </Card>

          <Card
            className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer"
            onClick={() => navigate("/presupuestos")}
          >
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2 text-foreground">Gestionar Presupuestos</h3>
              <p className="text-xs md:text-sm text-muted-foreground">Ver, editar y administrar todos tus presupuestos</p>
            </CardContent>
          </Card>

          {/* Gestionar Pedidos - Solo para usuarios con acceso a producción */}
          {canAccessProduccion() && (
            <Card
              className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer"
              onClick={() => navigate("/pedidos")}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2 text-foreground">Gestionar Pedidos</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Accede a todos tus pedidos de venta</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

        {/* Version Info */}
        <div className={cn("mt-6 md:mt-8 flex justify-end", isMobile ? "px-4" : "")}>
          <button
            onClick={() => navigate("/novedades")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            EasyQuote v2.0.0
          </button>
        </div>

        {/* EasyQuote Brand Image */}
        <div className={cn("mt-4 flex justify-center", isMobile ? "px-4" : "")}>
          <img
            src="/lovable-uploads/calculator-icon.png"
            alt="EasyQuote"
            className="h-16 md:h-24 w-auto opacity-80"
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
