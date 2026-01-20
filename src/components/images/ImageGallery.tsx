import React, { useState } from "react";
import { Trash2, Eye, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useImageManagement, ImageData } from "@/hooks/useImageManagement";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ImageGalleryProps {
  onImageSelect?: (image: ImageData) => void;
  selectedImageId?: string;
  selectionMode?: boolean;
  className?: string;
  images?: ImageData[];
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  onImageSelect,
  selectedImageId,
  selectionMode = false,
  className = "",
  images: propImages,
}) => {
  // Solo usar el hook si no nos pasan imágenes por props
  const { images: hookImages, isLoading, deleteImage, isDeleting, fetchImageDetails } = useImageManagement();
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

  const getPreviewSize = (size: string) => {
    const sizes = {
      xsmall: "w-6 h-6",
      small: "w-8 h-8", 
      medium: "w-12 h-12",
      large: "w-16 h-16",
      xlarge: "w-20 h-20",
      xxlarge: "w-24 h-24"
    };
    return sizes[size.toLowerCase() as keyof typeof sizes] || "w-12 h-12";
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("URL copiada al portapapeles");
    setTimeout(() => setCopiedUrl(""), 2000);
  };

  // Get the best available URL for display
  const getImageUrl = (image: ImageData) => {
    return image.url || image.variants?.original?.medium || image.variants?.square?.medium;
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
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
        {images.map((image) => {
          const imageUrl = getImageUrl(image);
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
                    <p className="text-xs text-muted-foreground">
                      {new Date(image.dateCreated).toLocaleDateString()}
                    </p>
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
              
              <div>
                <h4 className="text-lg font-semibold mb-3">Variantes disponibles</h4>
                
                <div className="space-y-4">
                  {viewingImage.variants?.original && Object.keys(viewingImage.variants.original).length > 0 && (
                    <div>
                      <h5 className="text-md font-medium mb-3">Originales</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(viewingImage.variants.original).map(([size, url]) => (
                          url && (
                            <div key={size} className="flex flex-col items-center gap-2 p-3 border rounded-lg">
                              <div className="flex items-center justify-center w-40 h-24 bg-gray-50">
                                <img 
                                  src={url as string} 
                                  alt={`${size} preview`}
                                  className={`${getPreviewSize(size)} object-contain`}
                                />
                              </div>
                              <span className="text-sm font-medium capitalize">{size}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(url as string)}
                                className="h-7 px-2 w-full"
                              >
                                {copiedUrl === url ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                <span className="text-xs">
                                  {copiedUrl === url ? 'Copiado' : 'Copiar URL'}
                                </span>
                              </Button>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {viewingImage.variants?.square && Object.keys(viewingImage.variants.square).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h5 className="text-md font-medium mb-3">Cuadradas</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {Object.entries(viewingImage.variants.square).map(([size, url]) => (
                            url && (
                              <div key={size} className="flex flex-col items-center gap-2 p-3 border rounded-lg">
                                <div className="flex items-center justify-center w-40 h-24 bg-gray-50">
                                  <img 
                                    src={url as string} 
                                    alt={`${size} square preview`}
                                    className={`${getPreviewSize(size)} object-contain`}
                                  />
                                </div>
                                <span className="text-sm font-medium capitalize">{size}</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyToClipboard(url as string)}
                                  className="h-7 px-2 w-full"
                                >
                                  {copiedUrl === url ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                  <span className="text-xs">
                                    {copiedUrl === url ? 'Copiado' : 'Copiar URL'}
                                  </span>
                                </Button>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </>
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
