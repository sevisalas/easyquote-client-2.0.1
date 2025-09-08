import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Settings, 
  FileSpreadsheet, 
  Package, 
  Image, 
  Calculator,
  TrendingUp,
  Users,
  FileText,
  BarChart3,
  AlertCircle,
  ArrowRight,
  Wrench,
  Presentation
} from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

export default function AdminModeSelector() {
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

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Badge variant="outline" className="px-4 py-2">
            {isSuperAdmin ? "Super Administrador" : "Administrador"}
          </Badge>
        </div>
        
        <h1 className="text-4xl font-bold">Panel de Administración</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Selecciona el modo de gestión que necesitas para acceder a las herramientas específicas
        </p>
      </div>

      <Separator />

      {/* Mode Selection Cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        
        {/* Calculators Management Mode */}
        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Calculator className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Gestión de Calculadores</CardTitle>
                <Badge variant="secondary" className="mt-1">
                  <Wrench className="h-3 w-3 mr-1" />
                  Configuración
                </Badge>
              </div>
            </div>
            <CardDescription className="text-base">
              Administra productos, archivos Excel, imágenes y configuraciones del sistema de cálculo
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Features List */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Package className="h-4 w-4 text-blue-600" />
                <span>Gestión completa de productos y catálogos</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                <span>Importación y procesamiento de archivos Excel</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Image className="h-4 w-4 text-blue-600" />
                <span>Administración de imágenes y recursos</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Settings className="h-4 w-4 text-blue-600" />
                <span>Configuraciones avanzadas del sistema</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button asChild className="w-full" size="lg">
                <Link to="/admin/calculadores" className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Acceder a Calculadores
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quotes Management Mode */}
        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-500/10 to-transparent" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Gestión de Presupuestos</CardTitle>
                <Badge variant="secondary" className="mt-1">
                  <Presentation className="h-3 w-3 mr-1" />
                  Operaciones
                </Badge>
              </div>
            </div>
            <CardDescription className="text-base">
              Administra presupuestos, clientes, estadísticas de ventas y reportes del negocio
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Features List */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-green-600" />
                <span>Gestión completa de presupuestos y cotizaciones</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-green-600" />
                <span>Administración de clientes y contactos</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span>Estadísticas y métricas de ventas</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <BarChart3 className="h-4 w-4 text-green-600" />
                <span>Reportes y análisis de negocio</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button asChild className="w-full" size="lg">
                <Link to="/admin/presupuestos" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Acceder a Presupuestos
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Vista Rápida del Sistema</CardTitle>
            <CardDescription className="text-center">
              Métricas generales para orientar tu gestión
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center space-y-2">
                <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">24</div>
                <div className="text-sm text-muted-foreground">Productos</div>
              </div>
              
              <div className="text-center space-y-2">
                <div className="h-10 w-10 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold">142</div>
                <div className="text-sm text-muted-foreground">Presupuestos</div>
              </div>
              
              <div className="text-center space-y-2">
                <div className="h-10 w-10 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-2xl font-bold">67</div>
                <div className="text-sm text-muted-foreground">Clientes</div>
              </div>
              
              <div className="text-center space-y-2">
                <div className="h-10 w-10 bg-orange-500/10 rounded-lg flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="h-5 w-5 text-orange-600" />
                </div>
                <div className="text-2xl font-bold">8</div>
                <div className="text-sm text-muted-foreground">Archivos Excel</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}