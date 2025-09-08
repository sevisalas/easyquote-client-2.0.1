import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { 
  Package, 
  Search, 
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";

// Interface para productos del API de EasyQuote
interface EasyQuoteProduct {
  productId: string;
  productName: string;
  isActive: boolean;
  prompts?: any[];
  category?: string;
  description?: string;
  basePrice?: number;
  [key: string]: any; // Para otros campos del API
}

export default function ProductManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  
  const { isSuperAdmin, isOrgAdmin, organization, membership } = useSubscription();

  // Check permissions
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden ver productos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Obtener ID de la organización
  const organizationId = organization?.id || membership?.organization_id;

  // Obtener token de EasyQuote de la integración
  const { data: integrationData, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ["easyquote-integration"],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error("No organization found");
      }

      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("integration_type", "easyquote")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId
  });

  // Fetch products from EasyQuote API
  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ["easyquote-products", includeInactive],
    queryFn: async () => {
      if (!integrationData?.configuration || typeof integrationData.configuration !== 'object') {
        throw new Error("No EasyQuote integration configuration found");
      }

      const config = integrationData.configuration as { access_token?: string };
      if (!config.access_token) {
        throw new Error("No EasyQuote integration token found");
      }

      console.log("ProductManagement: Fetching products", { includeInactive });

      const { data, error } = await supabase.functions.invoke("easyquote-products", {
        body: { 
          token: config.access_token,
          includeInactive 
        }
      });

      if (error) {
        console.error("ProductManagement: Edge function error", error);
        throw error;
      }

      if (!data) {
        console.warn("ProductManagement: No data received");
        return [];
      }

      console.log("ProductManagement: Products received", data.length);
      return data as EasyQuoteProduct[];
    },
    enabled: !!integrationData?.configuration,
    retry: (failureCount, error: any) => {
      // Si es error de autorización, no reintentar
      if (error?.message?.includes("401") || error?.message?.includes("EASYQUOTE_UNAUTHORIZED")) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Filtrar productos localmente
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === "all" || 
      product.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Obtener categorías únicas
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  // Estadísticas
  const activeProducts = products.filter(p => p.isActive);
  const inactiveProducts = products.filter(p => !p.isActive);

  const exportProducts = () => {
    const csvContent = [
      ["ID", "Nombre", "Estado", "Categoría", "Descripción"].join(","),
      ...filteredProducts.map(product => [
        `"${product.productId}"`,
        `"${product.productName}"`,
        product.isActive ? "Activo" : "Inactivo",
        `"${product.category || ""}"`,
        `"${product.description || ""}"`
      ].join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "productos-easyquote.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoadingIntegration) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando integración con EasyQuote...</p>
        </div>
      </div>
    );
  }

  if (!integrationData) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Integración requerida</AlertTitle>
          <AlertDescription>
            Para ver los productos, necesitas configurar la integración con EasyQuote.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>No se pudieron cargar los productos de EasyQuote.</p>
            {error.message && (
              <p className="text-sm">{error.message}</p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="mt-2"
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos EasyQuote</h1>
          <p className="text-muted-foreground mt-2">
            Catálogo de productos del API de EasyQuote para presupuestos
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportProducts} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Separator />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Busca y filtra productos por diferentes criterios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Buscar productos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por nombre, ID o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label>Categoría</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
              <Label htmlFor="include-inactive">Incluir inactivos</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">
              Mostrando: {filteredProducts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Productos Inactivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{inactiveProducts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Lista de productos obtenidos del API de EasyQuote
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando productos desde EasyQuote...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {products.length === 0 
                  ? "No hay productos en EasyQuote" 
                  : "No hay productos que coincidan con los filtros"
                }
              </p>
              {searchTerm || categoryFilter !== "all" ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                  }}
                  className="mt-2"
                >
                  Limpiar filtros
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Prompts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.productName}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground">
                            {product.description.length > 80 
                              ? product.description.substring(0, 80) + "..."
                              : product.description
                            }
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{product.productId}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        <div className="flex items-center gap-1">
                          {product.isActive ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {product.isActive ? "Activo" : "Inactivo"}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge variant="outline">{product.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Sin categoría</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {product.prompts?.length || 0} campos
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}