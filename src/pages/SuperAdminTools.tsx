import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/contexts/SubscriptionContext";
import OrgSelector from "@/components/superadmin/OrgSelector";
import ProductTestPage from "@/pages/ProductTestPage";
import { EasyQuoteConnectivityTest } from "@/components/diagnostics/EasyQuoteConnectivityTest";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Wrench, Package, Wifi, BarChart3, RefreshCw, AlertCircle, Shield } from "lucide-react";

export default function SuperAdminTools() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useSubscription();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<"idle" | "success" | "error">("idle");
  const [activeTab, setActiveTab] = useState("productos");

  // Redirect if not superadmin
  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, loading, navigate]);

  // Refresh EasyQuote token when org changes
  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    setTokenStatus("idle");
    
    // Clear existing token
    sessionStorage.removeItem("easyquote_token");
    
    // Get new token for the selected organization
    setIsRefreshingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("easyquote-refresh-token", {
        body: { organization_id: orgId }
      });

      if (error) throw error;

      if (data?.token) {
        sessionStorage.setItem("easyquote_token", data.token);
        window.dispatchEvent(new CustomEvent("easyquote-token-updated"));
        setTokenStatus("success");
        toast({
          title: "Token obtenido",
          description: "Token de EasyQuote cargado para la organización seleccionada",
        });
      } else {
        throw new Error("No token in response");
      }
    } catch (err) {
      console.error("Error refreshing token for org:", err);
      setTokenStatus("error");
      toast({
        title: "Error",
        description: "No se pudo obtener el token de EasyQuote para esta organización",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const handleRefreshToken = async () => {
    if (!selectedOrgId) return;
    await handleOrgChange(selectedOrgId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Wrench className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Herramientas técnicas</h1>
          <p className="text-muted-foreground">
            Diagnóstico, pruebas y análisis para soporte técnico
          </p>
        </div>
      </div>

      {/* Organization Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Impersonación de organización
          </CardTitle>
          <CardDescription>
            Selecciona una organización para acceder a sus datos y configuración.
            El token de EasyQuote se generará con las credenciales de esa organización.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <OrgSelector
              value={selectedOrgId}
              onValueChange={handleOrgChange}
              label="Organización a diagnosticar"
              className="flex-1 max-w-md"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefreshToken}
              disabled={!selectedOrgId || isRefreshingToken}
              title="Refrescar token"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingToken ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Token Status */}
          {tokenStatus === "success" && selectedOrgId && (
            <Alert className="mt-4 border-primary/50 bg-primary/10">
              <AlertDescription className="text-primary">
                ✓ Token de EasyQuote activo para la organización seleccionada
              </AlertDescription>
            </Alert>
          )}
          {tokenStatus === "error" && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No se pudo obtener el token. Verifica que la organización tenga credenciales configuradas.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tools Tabs */}
      {selectedOrgId ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="productos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="conectividad" className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Conectividad
            </TabsTrigger>
            <TabsTrigger value="metricas" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="productos" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Prueba de productos</CardTitle>
                <CardDescription>
                  Prueba cálculos de productos y ve los prompts/outputs en detalle
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t">
                  <ProductTestPage 
                    overrideOrganizationId={selectedOrgId} 
                    showDebugTools={true}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conectividad" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Test de conectividad API</CardTitle>
                <CardDescription>
                  Verifica la conexión con la API de EasyQuote
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EasyQuoteConnectivityTest />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metricas" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Métricas del sistema</CardTitle>
                <CardDescription>
                  Estadísticas y rendimiento de la API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Las métricas detalladas están disponibles en el{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => navigate("/superadmin/dashboard")}
                  >
                    Dashboard de SuperAdmin
                  </Button>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecciona una organización</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Para acceder a las herramientas técnicas, primero debes seleccionar
              la organización que deseas diagnosticar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
