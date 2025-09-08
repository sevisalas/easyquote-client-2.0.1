import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  FileText, 
  Users, 
  TrendingUp, 
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Plus,
  Edit,
  Eye,
  ArrowLeft,
  Activity,
  DollarSign,
  Calendar,
  Target
} from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function PresupuestosDashboard() {
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Check permissions
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden acceder a esta sección.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch quotes stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["quotes-dashboard-stats"],
    queryFn: async () => {
      // Get quotes count and totals
      const { data: quotes, count: quotesCount } = await supabase
        .from("quotes")
        .select("final_price, status, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(10);

      // Get customers count
      const { count: customersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });

      // Calculate totals
      const totalValue = quotes?.reduce((sum, quote) => sum + (quote.final_price || 0), 0) || 0;
      const draftQuotes = quotes?.filter(q => q.status === 'draft').length || 0;
      const completedQuotes = quotes?.filter(q => q.status === 'completed').length || 0;

      return {
        totalQuotes: quotesCount || 0,
        totalCustomers: customersCount || 0,
        totalValue,
        draftQuotes,
        completedQuotes,
        recentQuotes: quotes || [],
        conversionRate: quotesCount ? (completedQuotes / quotesCount * 100) : 0
      };
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin" className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Gestión de Presupuestos</h1>
          <p className="text-muted-foreground">
            Administra presupuestos, clientes y estadísticas de ventas
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <BarChart3 className="h-4 w-4 mr-2" />
          Modo Operaciones
        </Badge>
      </div>

      <Separator />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Presupuestos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalQuotes || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+12%</span> vs. mes anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Valor total de presupuestos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversión</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Tasa de conversión
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Management Sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Quotes Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gestión de Presupuestos
            </CardTitle>
            <CardDescription>
              Administra cotizaciones y presupuestos de clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Borradores</span>
                <Badge variant="secondary">{stats?.draftQuotes || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Completados</span>
                <Badge variant="secondary">{stats?.completedQuotes || 0}</Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Meta mensual</span>
                <span>75% completado</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
            
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to="/presupuestos" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Gestionar
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/presupuestos/nuevo" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customers Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestión de Clientes
            </CardTitle>
            <CardDescription>
              Administra la base de datos de clientes y contactos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Clientes activos</span>
                <Badge variant="secondary">{stats?.totalCustomers || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Nuevos este mes</span>
                <Badge variant="secondary">8</Badge>
              </div>
            </div>
            
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertDescription className="text-xs">
                3 clientes con presupuestos pendientes
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to="/clientes" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Gestionar
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/clientes/nuevo" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sales Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Análisis de Ventas
            </CardTitle>
            <CardDescription>
              Métricas y estadísticas de rendimiento comercial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Promedio por presupuesto</span>
                <Badge variant="outline">
                  {formatCurrency(stats?.totalQuotes ? (stats.totalValue / stats.totalQuotes) : 0)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Tendencia mensual</span>
                <Badge variant="outline" className="text-green-600">↗ +12%</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Mejor cliente</span>
                <Badge variant="outline">Cliente VIP</Badge>
              </div>
            </div>
            
            <Button size="sm" variant="outline" className="w-full">
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Reportes Completos
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>
              Últimos presupuestos y acciones del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : stats?.recentQuotes.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No hay actividad reciente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.recentQuotes.slice(0, 3).map((quote, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                      <span>Presupuesto {formatCurrency(quote.final_price)}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(quote.created_at), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            <Button size="sm" variant="outline" asChild className="w-full">
              <Link to="/presupuestos">
                <Eye className="h-4 w-4 mr-2" />
                Ver Todos
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle>Acceso Rápido</CardTitle>
          <CardDescription>
            Funciones más utilizadas para la gestión comercial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/presupuestos/nuevo">
                <Plus className="h-6 w-6" />
                <span className="text-xs">Nuevo Presupuesto</span>
              </Link>
            </Button>
            
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/clientes/nuevo">
                <Users className="h-6 w-6" />
                <span className="text-xs">Nuevo Cliente</span>
              </Link>
            </Button>
            
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/presupuestos">
                <FileText className="h-6 w-6" />
                <span className="text-xs">Ver Presupuestos</span>
              </Link>
            </Button>
            
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/clientes">
                <BarChart3 className="h-6 w-6" />
                <span className="text-xs">Ver Clientes</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}