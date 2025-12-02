import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Package, Image, ArrowRight, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const ApiHome = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");

  // Obtener estadísticas de archivos Excel
  const { data: excelStats } = useQuery({
    queryKey: ["excel-stats"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { total: 0, processed: 0, master: 0 };

      const { data, error } = await supabase
        .from("excel_files")
        .select("processed, is_master")
        .eq("user_id", user.id);

      if (error) throw error;

      return {
        total: data?.length ?? 0,
        processed: data?.filter((f) => f.processed).length ?? 0,
        master: data?.filter((f) => f.is_master).length ?? 0,
      };
    },
  });

  // Obtener estadísticas de imágenes
  const { data: imageStats } = useQuery({
    queryKey: ["image-stats"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { total: 0, active: 0 };

      const { data, error } = await supabase
        .from("images")
        .select("is_active")
        .eq("user_id", user.id);

      if (error) throw error;

      return {
        total: data?.length ?? 0,
        active: data?.filter((img) => img.is_active).length ?? 0,
      };
    },
  });

  useEffect(() => {
    document.title = "Inicio | EasyQuote API";

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Intentar obtener display_name de organization_members
        const { data: member } = await supabase
          .from("organization_members")
          .select("display_name")
          .eq("user_id", user.id)
          .single();

        if (member?.display_name) {
          setUserName(member.display_name);
        } else {
          setUserName(user.email?.split("@")[0] || "Usuario");
        }
      }
    };

    getUser();
  }, []);

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row items-center md:justify-between gap-4 mb-6">
            <img
              src="/lovable-uploads/logo_transparente-removebg-preview.png"
              alt="EasyQuote"
              className="h-20 w-auto"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallbackApplied) {
                  img.src = "/lovable-uploads/logo_transparente.png";
                  img.dataset.fallbackApplied = "true";
                }
              }}
            />
            <div className="text-center md:text-right">
              <h1 className="text-2xl font-bold text-foreground">
                Hola, <span className="text-primary font-bold">{userName}</span>
              </h1>
              <p className="text-base text-muted-foreground mt-1">Gestiona tu configuración de productos</p>
            </div>
          </div>

          {/* Acción Principal */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/admin/productos")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Package className="w-5 h-5 mr-2" />
              Gestionar productos
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Excel Files Stats */}
          <Card className="border-primary/20 hover:border-primary/40 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Archivos Excel</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-2xl font-bold text-foreground">{excelStats?.total ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Procesados:</span>
                  <span className="text-lg font-semibold text-green-600">{excelStats?.processed ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Maestros:</span>
                  <span className="text-lg font-semibold text-blue-600">{excelStats?.master ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Images Stats */}
          <Card className="border-primary/20 hover:border-primary/40 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Image className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Imágenes</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-2xl font-bold text-foreground">{imageStats?.total ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Activas:</span>
                  <span className="text-lg font-semibold text-green-600">{imageStats?.active ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Card */}
          <Card className="border-primary/20 hover:border-primary/40 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Database className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Configuración API</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Gestiona productos, archivos Excel e imágenes para tu integración API
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/configuracion/archivos-excel")}
                className="w-full"
              >
                Ver configuración
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          <Card
            className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer"
            onClick={() => navigate("/configuracion/archivos-excel")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Archivos Excel</h3>
              <p className="text-sm text-muted-foreground">Gestiona tus archivos de configuración</p>
            </CardContent>
          </Card>

          <Card
            className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer"
            onClick={() => navigate("/admin/productos")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Productos</h3>
              <p className="text-sm text-muted-foreground">Configura y administra tus productos</p>
            </CardContent>
          </Card>

          <Card
            className="border-primary/20 hover:border-primary/40 transition-all group cursor-pointer"
            onClick={() => navigate("/configuracion/imagenes")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Image className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Galería de imágenes</h3>
              <p className="text-sm text-muted-foreground">Gestiona tus recursos visuales</p>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-2 text-foreground">Plan API</h3>
          <p className="text-sm text-muted-foreground">
            Tu plan actual te permite gestionar la configuración de productos, archivos Excel e imágenes para integración API. 
            Para acceder a funcionalidades comerciales como clientes, presupuestos y pedidos, contacta con tu administrador para actualizar tu plan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiHome;
