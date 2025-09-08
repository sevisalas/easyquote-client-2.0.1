import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Separator } from "@/components/ui/separator";

interface Product {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  category: string | null;
  sku: string | null;
  stock_quantity: number | null;
  excel_row_number: number | null;
  created_at: string;
  updated_at: string;
}

interface ProductFormData {
  name: string;
  price: string;
  description: string;
  category: string;
  sku: string;
  stock_quantity: string;
}

export default function ProductManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    price: "",
    description: "",
    category: "",
    sku: "",
    stock_quantity: ""
  });
  
  const queryClient = useQueryClient();
  const { isSuperAdmin, isOrgAdmin } = useSubscription();

  // Check permissions
  if (!isSuperAdmin && !isOrgAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden gestionar productos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch products
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products", searchTerm, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("additionals")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("type", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Transform additionals to products format for compatibility
      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        price: item.default_value,
        description: item.description,
        category: item.type,
        sku: null,
        stock_quantity: null,
        excel_row_number: null,
        created_at: item.created_at,
        updated_at: item.updated_at
      })) as Product[];
    }
  });

  // Get unique categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("additionals")
        .select("type")
        .not("type", "is", null);
      
      if (error) throw error;
      
      const uniqueCategories = [...new Set(data.map(item => item.type))];
      return uniqueCategories.filter(Boolean) as string[];
    }
  });

  // Create product mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const { error } = await supabase
        .from("additionals")
        .insert({
          name: data.name,
          default_value: data.price ? parseFloat(data.price) : 0,
          description: data.description || null,
          type: data.category || "producto",
          assignment_type: "article"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Producto creado",
        description: "El producto se ha creado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error al crear producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      const { error } = await supabase
        .from("additionals")
        .update({
          name: data.name,
          default_value: data.price ? parseFloat(data.price) : 0,
          description: data.description || null,
          type: data.category || "producto"
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setIsEditDialogOpen(false);
      resetForm();
      setEditingProduct(null);
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("additionals")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Producto eliminado",
        description: "El producto se ha eliminado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      description: "",
      category: "",
      sku: "",
      stock_quantity: ""
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price?.toString() || "",
      description: product.description || "",
      category: product.category || "",
      sku: product.sku || "",
      stock_quantity: product.stock_quantity?.toString() || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const exportProducts = () => {
    const csvContent = [
      ["Nombre", "Precio", "Descripción", "Categoría", "SKU", "Stock"].join(","),
      ...products.map(product => [
        `"${product.name}"`,
        product.price || "",
        `"${product.description || ""}"`,
        `"${product.category || ""}"`,
        `"${product.sku || ""}"`,
        product.stock_quantity || ""
      ].join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "productos.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudieron cargar los productos: {error.message}
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
          <h1 className="text-3xl font-bold">Gestión de Productos</h1>
          <p className="text-muted-foreground mt-2">
            Administra el catálogo de productos del sistema
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportProducts}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
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
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar productos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por nombre, SKU o descripción..."
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
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Con Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {products.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              0
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Lista completa de productos en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando productos...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay productos registrados</p>
              <p className="text-sm text-muted-foreground">
                Crea tu primer producto para comenzar
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground">
                            {product.description.substring(0, 50)}
                            {product.description.length > 50 && "..."}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge variant="secondary">{product.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Sin categoría</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.price ? (
                        <span className="font-medium">${product.price.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">No definido</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        Disponible
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {product.sku || "Sin SKU"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(product.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Product Dialog */}
      <Dialog 
        open={isCreateDialogOpen || isEditDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            resetForm();
            setEditingProduct(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Producto" : "Crear Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? "Modifica la información del producto seleccionado."
                : "Completa los campos para crear un nuevo producto."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del producto"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Categoría del producto"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="Código único"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción del producto..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Guardando..."
                : editingProduct
                ? "Actualizar Producto"
                : "Crear Producto"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}