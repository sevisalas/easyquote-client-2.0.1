import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Package, 
  FileSpreadsheet, 
  Image, 
  Settings,
  AlertCircle,
  CheckCircle2,
  Plus,
  Edit,
  Eye,
  ArrowLeft,
  Activity,
  Database,
  Upload,
  TestTube
} from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

export default function CalculadorDashboard() {
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

  // Fetch calculator stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["calculator-stats"],
    queryFn: async () => {
      // Get products count (using additionals table)
      const { count: productsCount } = await supabase
        .from("additionals")
        .select("*", { count: "exact", head: true });

      // Get Excel files from storage
      const { data: files } = await supabase.storage
        .from("excel-uploads")
        .list("", { limit: 100 });

      return {
        totalProducts: productsCount || 0,
        totalFiles: files?.length || 0,
        activeFiles: files?.length || 0, // Assume all are active for now
        storageUsed: files?.reduce((acc, file) => acc + (file.metadata?.size || 0), 0) || 0
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin" className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Gestión de Calculadores</h1>
          <p className="text-muted-foreground">
            Administra productos, archivos Excel y configuraciones del sistema de cálculo
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Database className="h-4 w-4 mr-2" />
          Modo Configuración
        </Badge>
      </div>

      <Separator />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Productos configurados
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
            <CardTitle className="text-sm font-medium">Almacenamiento</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats?.storageUsed || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Espacio utilizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">
              Sistema operativo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Management Sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Products Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestión de Productos
            </CardTitle>
            <CardDescription>
              Administra el catálogo de productos y sus configuraciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Total productos</span>
                <Badge variant="secondary">{stats?.totalProducts || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Categorías</span>
                <Badge variant="secondary">5</Badge>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to="/admin/productos" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Gestionar
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/productos/prueba" className="flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Probar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Excel Files Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Archivos Excel
            </CardTitle>
            <CardDescription>
              Importa y procesa archivos Excel para productos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Archivos totales</span>
                <Badge variant="secondary">{stats?.totalFiles || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Espacio usado</span>
                <Badge variant="secondary">{formatBytes(stats?.storageUsed || 0)}</Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Capacidad</span>
                <span>15% usado</span>
              </div>
              <Progress value={15} className="h-2" />
            </div>
            
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to="/configuracion/archivos-excel" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Gestionar
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/configuracion/archivos-excel" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Ver
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración del Sistema
            </CardTitle>
            <CardDescription>
              Ajustes globales y configuraciones avanzadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Plantilla PDF</span>
                <Badge variant="outline">Configurada</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Integraciones</span>
                <Badge variant="outline">2 activas</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Backup automático</span>
                <Badge variant="outline">Habilitado</Badge>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link to="/configuracion/plantilla-pdf" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configurar
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/configuracion/integraciones" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Ver
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assets & Media */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Recursos y Medios
            </CardTitle>
            <CardDescription>
              Gestiona imágenes, logos y recursos visuales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Imágenes</span>
                <Badge variant="secondary">12</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Logos</span>
                <Badge variant="secondary">3</Badge>
              </div>
            </div>
            
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Próximamente: Gestión de medios integrada
              </AlertDescription>
            </Alert>
            
            <Button size="sm" variant="outline" disabled className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Próximamente
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle>Acceso Rápido</CardTitle>
          <CardDescription>
            Funciones más utilizadas para la gestión de calculadores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/admin/productos">
                <Package className="h-6 w-6" />
                <span className="text-xs">Crear Producto</span>
              </Link>
            </Button>
            
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/configuracion/archivos-excel">
                <Upload className="h-6 w-6" />
                <span className="text-xs">Subir Excel</span>
              </Link>
            </Button>
            
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/admin/productos/prueba">
                <TestTube className="h-6 w-6" />
                <span className="text-xs">Probar Productos</span>
              </Link>
            </Button>
            
            <Button variant="outline" size="sm" asChild className="h-auto flex-col gap-2 py-4">
              <Link to="/configuracion/plantilla-pdf">
                <Settings className="h-6 w-6" />
                <span className="text-xs">Configurar PDF</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}