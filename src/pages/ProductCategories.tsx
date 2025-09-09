import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Tag, Tags } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { 
  useProductCategories, 
  type ProductCategory, 
  type ProductSubcategory,
  type CategoryFormData,
  type SubcategoryFormData 
} from "@/hooks/useProductCategories";

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#eab308'
];

export default function ProductCategories() {
  const { isSuperAdmin, isOrgAdmin } = useSubscription();
  const {
    categories,
    subcategories,
    categoriesLoading,
    subcategoriesLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory
  } = useProductCategories();

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<ProductSubcategory | null>(null);
  
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: "",
    description: "",
    color: DEFAULT_COLORS[0],
    is_active: true
  });

  const [subcategoryForm, setSubcategoryForm] = useState<SubcategoryFormData>({
    name: "",
    description: "",
    category_id: "",
    is_active: true
  });

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

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
      color: DEFAULT_COLORS[0],
      is_active: true
    });
    setIsCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: ProductCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      color: category.color,
      is_active: category.is_active
    });
    setIsCategoryDialogOpen(true);
  };

  const handleCreateSubcategory = () => {
    setEditingSubcategory(null);
    setSubcategoryForm({
      name: "",
      description: "",
      category_id: "",
      is_active: true
    });
    setIsSubcategoryDialogOpen(true);
  };

  const handleEditSubcategory = (subcategory: ProductSubcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryForm({
      name: subcategory.name,
      description: subcategory.description || "",
      category_id: subcategory.category_id,
      is_active: subcategory.is_active
    });
    setIsSubcategoryDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (editingCategory) {
      updateCategory.mutate({
        id: editingCategory.id,
        data: categoryForm
      });
    } else {
      createCategory.mutate(categoryForm);
    }
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
      color: DEFAULT_COLORS[0],
      is_active: true
    });
  };

  const handleSaveSubcategory = () => {
    if (editingSubcategory) {
      updateSubcategory.mutate({
        id: editingSubcategory.id,
        data: subcategoryForm
      });
    } else {
      createSubcategory.mutate(subcategoryForm);
    }
    setIsSubcategoryDialogOpen(false);
    setEditingSubcategory(null);
    setSubcategoryForm({
      name: "",
      description: "",
      category_id: "",
      is_active: true
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorías de Productos</h1>
          <p className="text-muted-foreground">
            Administra las categorías y subcategorías de tus productos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tag className="h-5 w-5" />
                <CardTitle>Categorías</CardTitle>
              </div>
              <Button onClick={handleCreateCategory} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Categoría
              </Button>
            </div>
            <CardDescription>
              Gestiona las categorías principales de productos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <div className="text-center py-4">Cargando categorías...</div>
            ) : (
              <div className="space-y-4">
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay categorías creadas</p>
                    <p className="text-sm">Crea tu primera categoría para empezar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: category.color }}
                              />
                              <div>
                                <div className="font-medium">{category.name}</div>
                                {category.description && (
                                  <div className="text-sm text-muted-foreground">
                                    {category.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={category.is_active ? "default" : "secondary"}>
                              {category.is_active ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditCategory(category)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCategory.mutate(category.id)}
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subcategories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tags className="h-5 w-5" />
                <CardTitle>Subcategorías</CardTitle>
              </div>
              <Button 
                onClick={handleCreateSubcategory} 
                size="sm"
                disabled={categories.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Subcategoría
              </Button>
            </div>
            <CardDescription>
              Gestiona las subcategorías de productos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subcategoriesLoading ? (
              <div className="text-center py-4">Cargando subcategorías...</div>
            ) : (
              <div className="space-y-4">
                {categories.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Sin categorías</AlertTitle>
                    <AlertDescription>
                      Debes crear al menos una categoría antes de poder crear subcategorías.
                    </AlertDescription>
                  </Alert>
                ) : subcategories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Tags className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay subcategorías creadas</p>
                    <p className="text-sm">Crea tu primera subcategoría para empezar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subcategories.map((subcategory) => (
                        <TableRow key={subcategory.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{subcategory.name}</div>
                              {subcategory.description && (
                                <div className="text-sm text-muted-foreground">
                                  {subcategory.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {subcategory.product_categories && (
                              <div className="flex items-center space-x-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: subcategory.product_categories.color }}
                                />
                                <span className="text-sm">{subcategory.product_categories.name}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={subcategory.is_active ? "default" : "secondary"}>
                              {subcategory.is_active ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSubcategory(subcategory)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSubcategory.mutate(subcategory.id)}
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? "Modifica los datos de la categoría" : "Crea una nueva categoría de productos"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Nombre de la categoría"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      categoryForm.color === color ? "border-primary" : "border-gray-200"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryForm({ ...categoryForm, color })}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              onClick={handleSaveCategory}
              disabled={!categoryForm.name.trim()}
            >
              {editingCategory ? "Actualizar" : "Crear"} Categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? "Editar Subcategoría" : "Nueva Subcategoría"}
            </DialogTitle>
            <DialogDescription>
              {editingSubcategory ? "Modifica los datos de la subcategoría" : "Crea una nueva subcategoría de productos"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory-name">Nombre</Label>
              <Input
                id="subcategory-name"
                value={subcategoryForm.name}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                placeholder="Nombre de la subcategoría"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={subcategoryForm.category_id}
                onValueChange={(value) => setSubcategoryForm({ ...subcategoryForm, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(cat => cat.is_active).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subcategory-description">Descripción</Label>
              <Textarea
                id="subcategory-description"
                value={subcategoryForm.description}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              onClick={handleSaveSubcategory}
              disabled={!subcategoryForm.name.trim() || !subcategoryForm.category_id}
            >
              {editingSubcategory ? "Actualizar" : "Crear"} Subcategoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}