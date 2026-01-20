import React, { useState } from "react";
import { useImageCategories, ImageCategory } from "@/hooks/useImageCategories";
import { useImageSubcategories, ImageSubcategory } from "@/hooks/useImageSubcategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Folder, ChevronRight, ChevronDown } from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export const ImageCategoryManager: React.FC = () => {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory, isCreating } = useImageCategories();
  const { subcategories, getSubcategoriesForCategory, createSubcategory, updateSubcategory, deleteSubcategory, isCreating: isCreatingSub } = useImageSubcategories();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ImageCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<ImageSubcategory | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ type: "category" | "subcategory"; item: ImageCategory | ImageSubcategory } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor(PRESET_COLORS[0]);
    setEditingCategory(null);
    setEditingSubcategory(null);
    setParentCategoryId(null);
  };

  const handleOpenCategoryDialog = (category?: ImageCategory) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setDescription(category.description || "");
      setColor(category.color);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleOpenSubcategoryDialog = (categoryId: string, subcategory?: ImageSubcategory) => {
    setParentCategoryId(categoryId);
    if (subcategory) {
      setEditingSubcategory(subcategory);
      setName(subcategory.name);
      setDescription(subcategory.description || "");
    } else {
      setName("");
      setDescription("");
    }
    setIsSubDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setIsSubDialogOpen(false);
    resetForm();
  };

  const handleSubmitCategory = () => {
    if (!name.trim()) return;

    if (editingCategory) {
      updateCategory({
        id: editingCategory.id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
    } else {
      createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
    }
    handleCloseDialog();
  };

  const handleSubmitSubcategory = () => {
    if (!name.trim() || !parentCategoryId) return;

    if (editingSubcategory) {
      updateSubcategory({
        id: editingSubcategory.id,
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } else {
      createSubcategory({
        categoryId: parentCategoryId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
    }
    handleCloseDialog();
  };

  const handleDeleteClick = (type: "category" | "subcategory", item: ImageCategory | ImageSubcategory) => {
    setCategoryToDelete({ type, item });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (categoryToDelete) {
      if (categoryToDelete.type === "category") {
        deleteCategory(categoryToDelete.item.id);
      } else {
        deleteSubcategory(categoryToDelete.item.id);
      }
    }
    setIsDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Categorías de imágenes</h3>
        <Button onClick={() => handleOpenCategoryDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva categoría
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No hay categorías creadas</p>
          <p className="text-sm">Crea categorías para organizar tus imágenes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => {
            const subs = getSubcategoriesForCategory(category.id);
            const isExpanded = expandedCategories.has(category.id);

            return (
              <Collapsible key={category.id} open={isExpanded} onOpenChange={() => toggleCategory(category.id)}>
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-muted-foreground truncate">{category.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {subs.length} sub
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenSubcategoryDialog(category.id)}
                        title="Añadir subcategoría"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenCategoryDialog(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDeleteClick("category", category)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <CollapsibleContent>
                    {subs.length > 0 && (
                      <div className="border-t px-3 py-2 space-y-1 bg-muted/30">
                        {subs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between py-2 px-3 rounded hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 ml-6">
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                              <div>
                                <p className="text-sm font-medium">{sub.name}</p>
                                {sub.description && (
                                  <p className="text-xs text-muted-foreground">{sub.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleOpenSubcategoryDialog(category.id, sub)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDeleteClick("subcategory", sub)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {subs.length === 0 && (
                      <div className="border-t px-3 py-4 text-center text-sm text-muted-foreground bg-muted/30">
                        Sin subcategorías
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Fly Banners, Roll Ups..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-description">Descripción</Label>
              <Input
                id="cat-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === presetColor
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => setColor(presetColor)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitCategory} disabled={!name.trim() || isCreating}>
              {editingCategory ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubDialogOpen} onOpenChange={setIsSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? "Editar subcategoría" : "Nueva subcategoría"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sub-name">Nombre *</Label>
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: 80x200, 100x200..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-description">Descripción</Label>
              <Input
                id="sub-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitSubcategory} disabled={!name.trim() || isCreatingSub}>
              {editingSubcategory ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {categoryToDelete?.type === "category" ? "categoría" : "subcategoría"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete?.type === "category"
                ? `Se eliminará la categoría "${(categoryToDelete?.item as ImageCategory)?.name}" y todas sus subcategorías. Las imágenes asignadas quedarán sin clasificar.`
                : `Se eliminará la subcategoría "${(categoryToDelete?.item as ImageSubcategory)?.name}". Las imágenes asignadas mantendrán su categoría padre.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
