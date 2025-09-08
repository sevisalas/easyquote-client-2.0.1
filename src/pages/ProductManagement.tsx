import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Package, 
  Search, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Settings
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";

// Interface para productos del API de EasyQuote
interface EasyQuoteProduct {
  productId: string;
  productName: string;
  isActive: boolean;
  category?: string;
  description?: string;
  basePrice?: number;
  excelFileId?: string;
  [key: string]: any; // Para otros campos del API
}

interface ProductPrompt {
  promptId: string;
  productId: string;
  sequence: number;
  promptTypeId: number;
  title: string;
  isRequired: boolean;
}

interface ProductOutput {
  outputId: string;
  productId: string;
  outputName: string;
  outputTypeId: number;
  sequence: number;
}

export default function ProductManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<EasyQuoteProduct | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { isSuperAdmin, isOrgAdmin } = useSubscription();
  const queryClient = useQueryClient();

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

  // Verificar si hay token de EasyQuote
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("easyquote_token"));

  // Fetch products from EasyQuote API
  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ["easyquote-products", includeInactive],
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible. Por favor, inicia sesión nuevamente.");
      }

      console.log("ProductManagement: Fetching products", { includeInactive });

      const { data, error } = await supabase.functions.invoke("easyquote-products", {
        body: { 
          token,
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
    enabled: hasToken,
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

  // Mutation para actualizar producto
  const updateProductMutation = useMutation({
    mutationFn: async (updatedProduct: EasyQuoteProduct) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) {
        throw new Error("No hay token de EasyQuote disponible");
      }

      const response = await fetch("https://api.easyquote.cloud/api/v1/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedProduct)
      });

      if (!response.ok) {
        throw new Error("Error al actualizar el producto");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["easyquote-products"] });
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEditProduct = (product: EasyQuoteProduct) => {
    setSelectedProduct({ ...product });
    setIsEditDialogOpen(true);
  };

  const handleSaveProduct = () => {
    if (selectedProduct) {
      updateProductMutation.mutate(selectedProduct);
    }
  };

  if (!hasToken) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sesión requerida</AlertTitle>
          <AlertDescription>
            Para ver los productos, necesitas iniciar sesión en EasyQuote desde la página de presupuestos.
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
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <Package className="h-4 w-4 mr-2" />
            Actualizar
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
                  <TableHead>Acciones</TableHead>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica los detalles del producto EasyQuote
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="productName">Nombre del Producto</Label>
                  <Input
                    id="productName"
                    value={selectedProduct.productName}
                    onChange={(e) => setSelectedProduct({
                      ...selectedProduct,
                      productName: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Input
                    id="category"
                    value={selectedProduct.category || ""}
                    onChange={(e) => setSelectedProduct({
                      ...selectedProduct,
                      category: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={selectedProduct.description || ""}
                  onChange={(e) => setSelectedProduct({
                    ...selectedProduct,
                    description: e.target.value
                  })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={selectedProduct.isActive}
                  onCheckedChange={(checked) => setSelectedProduct({
                    ...selectedProduct,
                    isActive: checked
                  })}
                />
                <Label htmlFor="isActive">
                  Producto activo
                </Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveProduct}
                  disabled={updateProductMutation.isPending}
                >
                  {updateProductMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}