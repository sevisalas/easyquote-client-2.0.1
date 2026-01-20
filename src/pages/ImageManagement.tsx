import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageGallery } from "@/components/images/ImageGallery";
import { ImageUploader } from "@/components/images/ImageUploader";
import { ImageCategoryManager } from "@/components/images/ImageCategoryManager";
import { useImageManagement } from "@/hooks/useImageManagement";
import { useImageCategories } from "@/hooks/useImageCategories";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";

export default function ImageManagement() {
  const { images, isLoading } = useImageManagement();
  const { categories } = useImageCategories();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  const filteredImages = selectedCategoryFilter === "all" 
    ? images 
    : selectedCategoryFilter === "uncategorized"
      ? images.filter(img => !img.category_id)
      : images.filter(img => img.category_id === selectedCategoryFilter);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Imágenes</h1>
        <p className="text-muted-foreground">
          Administra tus imágenes para usar en productos y presupuestos
        </p>
      </div>

      <Tabs defaultValue="gallery" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="gallery">
            Galería ({images.length})
          </TabsTrigger>
          <TabsTrigger value="upload">Subir</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Galería de imágenes</CardTitle>
                  <CardDescription>
                    Gestiona tus imágenes. Puedes filtrar por categoría, editar y eliminar.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las imágenes</SelectItem>
                      <SelectItem value="uncategorized">Sin categoría</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedCategoryFilter !== "all" && (
                <div className="mt-2">
                  <Badge variant="secondary" className="gap-1">
                    {selectedCategoryFilter === "uncategorized" 
                      ? "Sin categoría" 
                      : categories.find(c => c.id === selectedCategoryFilter)?.name}
                    : {filteredImages.length} imágenes
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ImageGallery 
                images={filteredImages}
                categories={categories}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Subir nuevas imágenes</CardTitle>
              <CardDescription>
                Arrastra y suelta imágenes o haz clic para seleccionar archivos. 
                Formatos soportados: JPG, PNG, WebP, GIF (máx. 10MB cada una).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUploader multiple={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Categorías de imágenes</CardTitle>
              <CardDescription>
                Crea y gestiona categorías para organizar tus imágenes por producto o tipo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageCategoryManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
