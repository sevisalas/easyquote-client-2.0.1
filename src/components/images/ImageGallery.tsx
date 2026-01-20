import React, { useState } from "react";
import { Trash2, Eye, Copy, Check, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useImageManagement, ImageData } from "@/hooks/useImageManagement";
import { useImageCategories } from "@/hooks/useImageCategories";
import { useImageSubcategories } from "@/hooks/useImageSubcategories";
import { useImageCategoryAssignments } from "@/hooks/useImageCategoryAssignments";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface ImageGalleryProps {
  onImageSelect?: (image: ImageData) => void;
  selectedImageId?: string;
  selectionMode?: boolean;
  className?: string;
  images?: ImageData[];
  showCategoryAssignment?: boolean;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  onImageSelect,
  selectedImageId,
  selectionMode = false,
  className = "",
  images: propImages,
  showCategoryAssignment = false,
}) => {
  const { images: hookImages, isLoading, deleteImage, isDeleting, fetchImageDetails } = useImageManagement();
  const { categories } = useImageCategories();
  const { subcategories, getSubcategoriesForCategory } = useImageSubcategories();
  const { getCategoryForImage, getSubcategoryForImage, assignCategory, isAssigning } = useImageCategoryAssignments();
  const images = propImages ?? hookImages;
  
  const [viewingImage, setViewingImage] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string>("");

  const handleViewImage = async (image: ImageData) => {
    setLoadingDetails(true);
    try {
      const details = await fetchImageDetails(image.id);
      setViewingImage(details);
    } catch (error) {
      toast.error("Error al cargar los detalles de la imagen");
      console.error(error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("URL copiada al portapapeles");
    setTimeout(() => setCopiedUrl(""), 2000);
  };

  const getImageUrl = (image: ImageData) => {
    return image.url || image.variants?.original?.medium || image.variants?.square?.medium;
  };

  const handleCategoryChange = (imageId: string, categoryId: string, subcategoryId?: string) => {
    assignCategory({
      imageId,
      categoryId: categoryId === "none" ? null : categoryId,
      subcategoryId: subcategoryId === "none" ? null : subcategoryId,
    });
  };

  const getAvailableSubcategories = (categoryId: string | null) => {
    if (!categoryId) return [];
    return getSubcategoriesForCategory(categoryId);
  };

  const getCategoryBadge = (imageId: string) => {
    const categoryId = getCategoryForImage(imageId);
    const subcategoryId = getSubcategoryForImage(imageId);
    if (!categoryId) return null;
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return null;
    const subcategory = subcategoryId ? subcategories.find((s) => s.id === subcategoryId) : null;
    
    return (
      <div className="flex flex-col gap-0.5">
        <Badge 
          variant="secondary" 
          className="text-xs gap-1"
          style={{ 
            backgroundColor: category.color + "20",
            borderColor: category.color,
            color: category.color,
          }}
        >
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
          {category.name}
        </Badge>
        {subcategory && (
          <Badge variant="outline" className="text-xs">
            {subcategory.name}
          </Badge>
        )}
      </div>
    );
  };

  if (isLoading && !propImages) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-0">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
          <Eye className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No hay imágenes</h3>
        <p className="text-muted-foreground">Sube tu primera imagen para comenzar</p>
      </div>
    );
  }

  return (
    <>
      <div className={`grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 ${className}`}>
        {images.map((image) => {
          const imageUrl = getImageUrl(image);
          const categoryBadge = getCategoryBadge(image.id);
          return (
            <Card 
              key={image.id} 
              className={`overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                selectedImageId === image.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => selectionMode && onImageSelect?.(image)}
            >
              <CardContent className="p-0">
                <div className="aspect-square relative">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={image.filename || image.original_filename || 'Image'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Eye className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  {categoryBadge && (
                    <div className="absolute bottom-2 left-2">
                      {categoryBadge}
                    </div>
                  )}
                  {!selectionMode && (
                    <div className="absolute top-2 right-2 flex space-x-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewImage(image);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("¿Estás seguro de que quieres eliminar esta imagen?")) {
                            deleteImage(image.id);
                          }
                        }}
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="p-3">
                  <p className="text-sm font-medium truncate mb-1">
                    {image.filename || image.original_filename || 'Sin nombre'}
                  </p>
                  {image.dateCreated && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {new Date(image.dateCreated).toLocaleDateString()}
                    </p>
                  )}
                  {showCategoryAssignment && (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={getCategoryForImage(image.id) || "none"}
                        onValueChange={(value) => handleCategoryChange(image.id, value)}
                        disabled={isAssigning}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin categoría</SelectItem>
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
                      {(() => {
                        const catId = getCategoryForImage(image.id);
                        const subs = catId ? getAvailableSubcategories(catId) : [];
                        if (subs.length === 0) return null;
                        return (
                          <Select
                            value={getSubcategoryForImage(image.id) || "none"}
                            onValueChange={(value) => handleCategoryChange(image.id, catId!, value)}
                            disabled={isAssigning}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Subcategoría" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin subcategoría</SelectItem>
                              {subs.map((sub) => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingImage?.filename}</DialogTitle>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ) : viewingImage && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <img
                  src={viewingImage.variants?.original?.medium || viewingImage.variants?.original?.small || viewingImage.url}
                  alt={viewingImage.filename}
                  className="max-w-full max-h-48 object-contain rounded-lg"
                />
              </div>

              {showCategoryAssignment && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2">Categoría</Label>
                    <Select
                      value={getCategoryForImage(viewingImage.id) || "none"}
                      onValueChange={(value) => handleCategoryChange(viewingImage.id, value)}
                      disabled={isAssigning}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
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
                  {(() => {
                    const catId = getCategoryForImage(viewingImage.id);
                    const subs = catId ? getAvailableSubcategories(catId) : [];
                    if (subs.length === 0) return null;
                    return (
                      <div>
                        <Label className="text-sm font-medium mb-2">Subcategoría</Label>
                        <Select
                          value={getSubcategoryForImage(viewingImage.id) || "none"}
                          onValueChange={(value) => handleCategoryChange(viewingImage.id, catId!, value)}
                          disabled={isAssigning}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sin subcategoría" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin subcategoría</SelectItem>
                            {subs.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <div>
                <h4 className="text-lg font-semibold mb-3">Versiones disponibles</h4>
                
                <div className="space-y-6">
                  {viewingImage.variants?.original && Object.keys(viewingImage.variants.original).length > 0 && (
                    <div>
                      <h5 className="text-md font-medium mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-primary"></span>
                        Originales ({Object.keys(viewingImage.variants.original).filter(k => viewingImage.variants.original[k]).length} tamaños)
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(['xsmall', 'small', 'medium', 'large', 'xlarge', 'xxlarge'] as const).map((size) => {
                          const url = viewingImage.variants?.original?.[size];
                          if (!url) return null;
                          const sizeLabels: Record<string, string> = {
                            xsmall: 'XS - Extra pequeño',
                            small: 'S - Pequeño',
                            medium: 'M - Mediano',
                            large: 'L - Grande',
                            xlarge: 'XL - Extra grande',
                            xxlarge: 'XXL - Máximo'
                          };
                          const previewSizes: Record<string, string> = {
                            xsmall: 'w-8 h-8',
                            small: 'w-12 h-12',
                            medium: 'w-16 h-16',
                            large: 'w-20 h-20',
                            xlarge: 'w-24 h-24',
                            xxlarge: 'w-28 h-28'
                          };
                          return (
                            <div key={size} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                              <div className={`flex items-center justify-center ${previewSizes[size]} bg-background rounded shrink-0`}>
                                <img 
                                  src={url} 
                                  alt={`Original ${size}`}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <span className="text-sm font-medium flex-1">{sizeLabels[size]}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(url)}
                                className="h-7 px-2 gap-1"
                              >
                                {copiedUrl === url ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span className="text-xs">{copiedUrl === url ? 'Copiado' : 'Copiar URL'}</span>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {viewingImage.variants?.square && Object.keys(viewingImage.variants.square).filter(k => viewingImage.variants.square[k]).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h5 className="text-md font-medium mb-3 flex items-center gap-2">
                          <span className="w-3 h-3 rounded bg-secondary"></span>
                          Cuadradas ({Object.keys(viewingImage.variants.square).filter(k => viewingImage.variants.square[k]).length} tamaños)
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(['xsmall', 'small', 'medium', 'large', 'xlarge', 'xxlarge'] as const).map((size) => {
                            const url = viewingImage.variants?.square?.[size];
                            if (!url) return null;
                            const sizeLabels: Record<string, string> = {
                              xsmall: 'XS - Extra pequeño',
                              small: 'S - Pequeño',
                              medium: 'M - Mediano',
                              large: 'L - Grande',
                              xlarge: 'XL - Extra grande',
                              xxlarge: 'XXL - Máximo'
                            };
                            const previewSizes: Record<string, string> = {
                              xsmall: 'w-8 h-8',
                              small: 'w-12 h-12',
                              medium: 'w-16 h-16',
                              large: 'w-20 h-20',
                              xlarge: 'w-24 h-24',
                              xxlarge: 'w-28 h-28'
                            };
                            return (
                              <div key={size} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                                <div className={`flex items-center justify-center ${previewSizes[size]} bg-background rounded shrink-0`}>
                                  <img 
                                    src={url} 
                                    alt={`Square ${size}`}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <span className="text-sm font-medium flex-1">{sizeLabels[size]}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyToClipboard(url)}
                                  className="h-7 px-2 gap-1"
                                >
                                  {copiedUrl === url ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span className="text-xs">{copiedUrl === url ? 'Copiado' : 'Copiar URL'}</span>
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {(!viewingImage.variants?.original || Object.keys(viewingImage.variants.original).filter(k => viewingImage.variants.original[k]).length === 0) &&
                   (!viewingImage.variants?.square || Object.keys(viewingImage.variants.square).filter(k => viewingImage.variants.square[k]).length === 0) && (
                    <p className="text-muted-foreground text-center py-4">No hay versiones disponibles para esta imagen</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
