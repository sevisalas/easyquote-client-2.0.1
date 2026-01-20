import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageGallery } from "@/components/images/ImageGallery";
import { ImageUploader } from "@/components/images/ImageUploader";
import { ImageCategoryManager } from "@/components/images/ImageCategoryManager";
import { useImageManagement } from "@/hooks/useImageManagement";
import { useImageCategories } from "@/hooks/useImageCategories";
import { useImageCategoryAssignments } from "@/hooks/useImageCategoryAssignments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, FolderOpen } from "lucide-react";

export default function ImageManagement() {
  const { images, isLoading } = useImageManagement();
  const { categories } = useImageCategories();
  const { getCategoryForImage, getImagesForCategory } = useImageCategoryAssignments();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Filter images by category
  const filteredImages = React.useMemo(() => {
    if (selectedCategoryFilter === "all") return images;
    if (selectedCategoryFilter === "uncategorized") {
      return images.filter((img) => !getCategoryForImage(img.id));
    }
    const imageIds = getImagesForCategory(selectedCategoryFilter);
    return images.filter((img) => imageIds.includes(img.id));
  }, [images, selectedCategoryFilter, getCategoryForImage, getImagesForCategory]);

  // Count images per category
  const getCategoryImageCount = (categoryId: string) => {
    return getImagesForCategory(categoryId).length;
  };

  const uncategorizedCount = images.filter((img) => !getCategoryForImage(img.id)).length;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Imágenes</h1>
        <p className="text-muted-foreground">
          Administra tus imágenes de EasyQuote para usar en productos y presupuestos
        </p>
      </div>

      <Tabs defaultValue="gallery" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="gallery">
            Galería ({images.length})
          </TabsTrigger>
          <TabsTrigger value="upload">Subir</TabsTrigger>
          <TabsTrigger value="categories">
            <FolderOpen className="h-4 w-4 mr-1" />
            Categorías
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Galería de imágenes</CardTitle>
                  <CardDescription>
                    Imágenes almacenadas en EasyQuote. Haz clic en una imagen para ver detalles y asignar categoría.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        Todas ({images.length})
                      </SelectItem>
                      <SelectItem value="uncategorized">
                        Sin categoría ({uncategorizedCount})
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name} ({getCategoryImageCount(cat.id)})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedCategoryFilter !== "all" && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="gap-1">
                    {selectedCategoryFilter === "uncategorized" ? (
                      "Sin categoría"
                    ) : (
                      <>
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: categories.find((c) => c.id === selectedCategoryFilter)?.color,
                          }}
                        />
                        {categories.find((c) => c.id === selectedCategoryFilter)?.name}
                      </>
                    )}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {filteredImages.length} imagen{filteredImages.length !== 1 ? "es" : ""}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ImageGallery images={filteredImages} showCategoryAssignment />
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
                Las imágenes se subirán a EasyQuote.
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
              <CardTitle>Gestión de categorías</CardTitle>
              <CardDescription>
                Crea y administra categorías para organizar tus imágenes.
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
