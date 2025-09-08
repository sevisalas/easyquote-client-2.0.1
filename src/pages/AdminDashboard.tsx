import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Users, 
  FileSpreadsheet, 
  Package, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  HardDrive,
  Activity
} from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalFiles: number;
  activeFiles: number;
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export default function AdminDashboard() {
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Check permissions
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden acceder al dashboard administrativo.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch dashboard statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      // Get total products (using existing table)
      const { count: productsCount } = await supabase
        .from("additionals")
        .select("*", { count: "exact", head: true });

      // Get total customers (users)
      const { count: usersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });

      // Get Excel files from storage
      const { data: files } = await supabase.storage
        .from("excel-uploads")
        .list("", { limit: 100 });

      // Get recent quotes for activity
      const { data: recentQuotes } = await supabase
        .from("quotes")
        .select("id, created_at, final_price, status")
        .order("created_at", { ascending: false })
        .limit(5);

      // Build activity feed
      const recentActivity = (recentQuotes || []).map((quote) => ({
        id: quote.id,
        type: "quote",
        message: `Nuevo presupuesto creado por $${quote.final_price}`,
        timestamp: quote.created_at
      }));

      return {
        totalUsers: usersCount || 0,
        totalProducts: productsCount || 0,
        totalFiles: files?.length || 0,
        activeFiles: files?.length || 0, // For now, assume all are active
        recentActivity
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get storage usage
  const { data: storageUsage } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: async () => {
      const { data: files } = await supabase.storage
        .from("excel-uploads")
        .list("", { limit: 1000 });
      
      const totalSize = files?.reduce((acc, file) => {
        return acc + (file.metadata?.size || 0);
      }, 0) || 0;

      return {
        used: totalSize,
        total: 1073741824, // 1GB limit for example
        percentage: Math.min((totalSize / 1073741824) * 100, 100)
      };
    }
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>
          <p className="text-muted-foreground mt-2">
            {isSuperAdmin 
              ? "Panel de control global del sistema"
              : "Panel de administración de la organización"
            }
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Activity className="h-4 w-4 mr-2" />
          {isSuperAdmin ? "Super Admin" : "Org Admin"}
        </Badge>
      </div>

      <Separator />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Productos disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Archivos Excel</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFiles || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats?.activeFiles || 0}</span> activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendencia</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+12%</div>
            <p className="text-xs text-muted-foreground">
              vs. mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Uso del Almacenamiento
            </CardTitle>
            <CardDescription>
              Espacio utilizado para archivos Excel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {storageUsage && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Usado</span>
                  <span>{formatBytes(storageUsage.used)} / {formatBytes(storageUsage.total)}</span>
                </div>
                <Progress value={storageUsage.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {storageUsage.percentage.toFixed(1)}% del espacio disponible
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Funciones principales de administración
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/configuracion/archivos-excel">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Gestionar Archivos Excel
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/clientes">
                <Users className="h-4 w-4 mr-2" />
                Gestionar Clientes
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/configuracion/ajustes">
                <Package className="h-4 w-4 mr-2" />
                Configurar Productos
              </Link>
            </Button>
            {isSuperAdmin && (
              <Button variant="outline" asChild className="w-full">
                <Link to="/usuarios">
                  <Users className="h-4 w-4 mr-2" />
                  Administrar Usuarios
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Actividad Reciente
          </CardTitle>
          <CardDescription>
            Últimas acciones en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay actividad reciente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats?.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                    {activity.type === "quote" ? (
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), {
                        addSuffix: true,
                        locale: es
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}