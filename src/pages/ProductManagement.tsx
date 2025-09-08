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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { 
  Package, 
  Search, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Settings,
  Plus,
  Trash2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";

// Interface para productos del API de EasyQuote
interface EasyQuoteProduct {
  id: string; // El API devuelve 'id', no 'productId'
  productName: string;
  isActive: boolean;
  category?: string;
  description?: string;
  basePrice?: number;
  excelfileId?: string;
  currency?: string;
  [key: string]: any; // Para otros campos del API
}

interface ProductPrompt {
  id: string; // El API usa 'id' no 'promptId'
  productId: string;
  promptSeq: number; // sequence en el API
  promptType: number; // promptTypeId en el API  
  promptSheet: string;
  promptCell: string; // título/nombre del prompt
  valueSheet: string;
  valueCell: string; // valor por defecto
  valueOptionSheet: string;
  valueOptionRange: string; // rango
  valueRequired: boolean; // isRequired en el API
  valueQuantityAllowedDecimals: number | null; // decimales
  valueQuantityMin: number | null; // qty min
  valueQuantityMax: number | null; // qty max
  tooltipValueSheet?: string | null;
  tooltipValueCell?: string | null;
  valueOptionLabelRange?: string | null;
}

interface ProductOutput {
  outputId: string;
  productId: string;
  outputName: string;
  outputTypeId: number;
  sequence: number;
  outputType?: string;
  sheet?: string;
  prompt?: string;
  defaultValue?: string;
  fieldType?: number;
}

interface PromptType {
  id: number;
  promptType: string;
}

interface OutputType {
  id: number;
  outputType: string;
}

export default function ProductManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<EasyQuoteProduct | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("easyquote_token"));
  
  const { isSuperAdmin, isOrgAdmin } = useSubscription();
  const queryClient = useQueryClient();
  
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL LOGIC
  // Queries para tipos de prompts y outputs
  const { data: promptTypes = [] } = useQuery({
    queryKey: ["prompt-types"],
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/prompts/types", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error fetching prompt types");
      return response.json();
    }
  });

  const { data: outputTypes = [] } = useQuery({
    queryKey: ["output-types"],
    queryFn: async () => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/outputs/types", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error fetching output types");
      return response.json();
    }
  });

  // Queries para prompts y outputs del producto seleccionado
  const { data: productPrompts = [], refetch: refetchPrompts, isLoading: promptsLoading } = useQuery({
    queryKey: ["product-prompts", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      
      console.log("Fetching prompts for product:", selectedProduct.id);
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch(`https://api.easyquote.cloud/api/v1/products/prompts/list/${selectedProduct.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error fetching product prompts");
      const data = await response.json();
      console.log("Product prompts received:", data);
      return data;
    },
    enabled: !!selectedProduct?.id
  });

  const { data: productOutputs = [], refetch: refetchOutputs, isLoading: outputsLoading } = useQuery({
    queryKey: ["product-outputs", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      
      console.log("Fetching outputs for product:", selectedProduct.id);
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch(`https://api.easyquote.cloud/api/v1/products/outputs/list/${selectedProduct.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error fetching product outputs");
      const data = await response.json();
      console.log("Product outputs received:", data);
      return data;
    },
    enabled: !!selectedProduct?.id
  });

  // Mutations para prompts y outputs
  const createPromptMutation = useMutation({
    mutationFn: async (newPrompt: Omit<ProductPrompt, 'id'>) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newPrompt)
      });

      if (!response.ok) throw new Error("Error creating prompt");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Prompt añadido",
        description: "El nuevo prompt se ha creado correctamente.",
      });
      refetchPrompts();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al crear el prompt",
        variant: "destructive",
      });
    }
  });

  const createOutputMutation = useMutation({
    mutationFn: async (newOutput: Omit<ProductOutput, 'outputId'>) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/outputs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newOutput)
      });

      if (!response.ok) throw new Error("Error creating output");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Output añadido",
        description: "El nuevo output se ha creado correctamente.",
      });
      refetchOutputs();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al crear el output",
        variant: "destructive",
      });
    }
  });

  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch(`https://api.easyquote.cloud/api/v1/products/prompts/${promptId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error deleting prompt");
    },
    onSuccess: () => {
      toast({
        title: "Prompt eliminado",
        description: "El prompt se ha eliminado correctamente.",
      });
      refetchPrompts();
    }
  });

  const deleteOutputMutation = useMutation({
    mutationFn: async (outputId: string) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch(`https://api.easyquote.cloud/api/v1/products/outputs/${outputId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Error deleting output");
    },
    onSuccess: () => {
      toast({
        title: "Output eliminado",
        description: "El output se ha eliminado correctamente.",
      });
      refetchOutputs();
    }
  });

  const updatePromptMutation = useMutation({
    mutationFn: async (updatedPrompt: ProductPrompt) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/prompts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedPrompt)
      });

      if (!response.ok) throw new Error("Error updating prompt");
      return response.json();
    },
    onSuccess: () => {
      refetchPrompts();
    }
  });

  const updateOutputMutation = useMutation({
    mutationFn: async (updatedOutput: ProductOutput) => {
      const token = localStorage.getItem("easyquote_token");
      if (!token) throw new Error("No token available");

      const response = await fetch("https://api.easyquote.cloud/api/v1/products/outputs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updatedOutput)
      });

      if (!response.ok) throw new Error("Error updating output");
      return response.json();
    },
    onSuccess: () => {
      refetchOutputs();
    }
  });


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
      product.id?.toLowerCase().includes(searchTerm.toLowerCase());

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

  // Add new prompt
  const addNewPrompt = () => {
    if (!selectedProduct || !promptTypes.length) return;

    const newPrompt = {
      productId: selectedProduct.id,
      promptSeq: productPrompts.length + 1,
      promptType: promptTypes[0]?.id || 0,
      promptSheet: "Main",
      promptCell: "A" + (productPrompts.length + 2),
      valueSheet: "Main", 
      valueCell: "B" + (productPrompts.length + 2),
      valueOptionSheet: "Main",
      valueOptionRange: "",
      valueRequired: false,
      valueQuantityAllowedDecimals: 0,
      valueQuantityMin: 1,
      valueQuantityMax: 9999
    };

    createPromptMutation.mutate(newPrompt);
  };

  // Add new output
  const addNewOutput = () => {
    if (!selectedProduct || !outputTypes.length) return;

    const newOutput = {
      productId: selectedProduct.id,
      sequence: productOutputs.length + 1,
      outputTypeId: outputTypes[0]?.id || 0,
      outputName: "Nuevo Output"
    };

    createOutputMutation.mutate(newOutput);
  };

  // Delete prompt
  const deletePrompt = (promptId: string) => {
    deletePromptMutation.mutate(promptId);
  };

  // Delete output
  const deleteOutput = (outputId: string) => {
    deleteOutputMutation.mutate(outputId);
  };

  // ALL CONDITIONAL LOGIC AND EARLY RETURNS MUST COME AFTER ALL HOOKS
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
                  <TableHead>Archivo Excel</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
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
                      <span className="font-mono text-sm text-muted-foreground">
                        {(() => {
                          const name = product.productName?.toLowerCase() || '';
                          if (name.includes('booklet')) return 'booklets.xlsx';
                          if (name.includes('landscaping')) return 'landscaping_materials.xlsx';
                          if (name.includes('shirt')) return 'shirts.xlsx';
                          if (name.includes('sofa')) return 'sofas.xlsx';
                          if (name.includes('tarjeta') || name.includes('visita')) return 'settings_una_hoja_1.0.xlsx';
                          if (name.includes('una hoja')) return 'settings_una_hoja_1.0.xlsx';
                          // Fallback: generar nombre basado en el producto
                          return name.replace(/\s+/g, '_') + '.xlsx';
                        })()}
                      </span>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica los detalles del producto, prompts y outputs
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="prompts">Prompts ({productPrompts.length})</TabsTrigger>
                <TabsTrigger value="outputs">Outputs ({productOutputs.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4">
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
                  <Textarea
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
                  <Label htmlFor="isActive">Producto activo</Label>
                </div>
              </TabsContent>

              <TabsContent value="prompts" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Prompts del Producto</h3>
                    <p className="text-sm text-muted-foreground">
                      Gestiona los campos de entrada para este producto
                    </p>
                  </div>
                  <Button onClick={addNewPrompt} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Prompt
                  </Button>
                </div>

                {isLoadingDetails ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Cargando prompts...</p>
                  </div>
                ) : productPrompts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay prompts configurados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productPrompts.map((prompt, index) => (
                      <div key={prompt.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-medium">Prompt #{index + 1}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePrompt(prompt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label>Título (Celda)</Label>
                            <Input
                              defaultValue={prompt.promptCell}
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, promptCell: e.target.value };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Tipo</Label>
                            <Select
                              value={prompt.promptType?.toString() || ""}
                              onValueChange={(value) => {
                                const updatedPrompt = { ...prompt, promptType: parseInt(value) };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                {promptTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id?.toString() || ""}>
                                    {type.promptType}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <Label>Valor por defecto (Celda)</Label>
                            <Input
                              defaultValue={prompt.valueCell || ""}
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, valueCell: e.target.value };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Orden</Label>
                            <Input
                              type="number"
                              defaultValue={prompt.promptSeq}
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, promptSeq: parseInt(e.target.value) };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Rango</Label>
                            <Input
                              defaultValue={prompt.valueOptionRange || ""}
                              placeholder="ej: $E$2:$E$3"
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, valueOptionRange: e.target.value };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div>
                            <Label>Decimales</Label>
                            <Input
                              type="number"
                              defaultValue={prompt.valueQuantityAllowedDecimals || 0}
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, valueQuantityAllowedDecimals: parseInt(e.target.value) };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Qty Min</Label>
                            <Input
                              type="number"
                              defaultValue={prompt.valueQuantityMin || 1}
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, valueQuantityMin: parseInt(e.target.value) };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Qty Max</Label>
                            <Input
                              type="number"
                              defaultValue={prompt.valueQuantityMax || 9999}
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, valueQuantityMax: parseInt(e.target.value) };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Sheet</Label>
                            <Input
                              defaultValue={prompt.promptSheet || "Main"}
                              onBlur={(e) => {
                                const updatedPrompt = { ...prompt, promptSheet: e.target.value };
                                updatePromptMutation.mutate(updatedPrompt);
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={prompt.valueRequired}
                            onCheckedChange={(checked) => {
                              const updatedPrompt = { ...prompt, valueRequired: checked };
                              updatePromptMutation.mutate(updatedPrompt);
                            }}
                          />
                          <Label>Campo requerido</Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="outputs" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Outputs del Producto</h3>
                    <p className="text-sm text-muted-foreground">
                      Gestiona los campos de salida para este producto
                    </p>
                  </div>
                  <Button onClick={addNewOutput} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Output
                  </Button>
                </div>

                {isLoadingDetails ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Cargando outputs...</p>
                  </div>
                ) : productOutputs.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay outputs configurados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productOutputs.map((output, index) => (
                      <div key={output.outputId} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-medium">Output #{index + 1}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOutput(output.outputId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label>Nombre</Label>
                            <Input
                              defaultValue={output.outputName}
                              onBlur={(e) => {
                                const updatedOutput = { ...output, outputName: e.target.value };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Tipo de Campo</Label>
                            <Select
                              value={output.outputTypeId?.toString() || ""}
                              onValueChange={(value) => {
                                const updatedOutput = { ...output, outputTypeId: parseInt(value) };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                {outputTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id?.toString() || ""}>
                                    {type.outputType}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Sheet</Label>
                            <Input
                              defaultValue={output.sheet || "Main"}
                              onBlur={(e) => {
                                const updatedOutput = { ...output, sheet: e.target.value };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Prompt</Label>
                            <Input
                              defaultValue={output.prompt || ""}
                              placeholder="ej: A25"
                              onBlur={(e) => {
                                const updatedOutput = { ...output, prompt: e.target.value };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Valor por defecto</Label>
                            <Input
                              defaultValue={output.defaultValue || ""}
                              placeholder="ej: B25"
                              onBlur={(e) => {
                                const updatedOutput = { ...output, defaultValue: e.target.value };
                                updateOutputMutation.mutate(updatedOutput);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

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
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}