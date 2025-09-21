import React, { useState } from "react";
import { Trash2, Edit, Tag, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useImageManagement, ImageData } from "@/hooks/useImageManagement";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageGalleryProps {
  onImageSelect?: (image: ImageData) => void;
  selectedImageId?: string;
  selectionMode?: boolean;
  className?: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  onImageSelect,
  selectedImageId,
  selectionMode = false,
  className = "",
}) => {
  const { images, isLoading, deleteImage, updateImage, isDeleting } = useImageManagement();
  const [editingImage, setEditingImage] = useState<ImageData | null>(null);
  const [viewingImage, setViewingImage] = useState<ImageData | null>(null);
  const [editTags, setEditTags] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");

  const handleEditImage = (image: ImageData) => {
    setEditingImage(image);
    setEditTags(image.tags.join(", "));
    setEditDescription(image.description || "");
  };

  const handleSaveEdit = () => {
    if (!editingImage) return;

    const tags = editTags
      .split(",")
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    updateImage({
      imageId: editingImage.id,
      tags,
      description: editDescription,
    });

    setEditingImage(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (isLoading) {
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
        {images.map((image) => (
          <Card 
            key={image.id} 
            className={`overflow-hidden cursor-pointer transition-all hover:shadow-md ${
              selectedImageId === image.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => selectionMode && onImageSelect?.(image)}
          >
            <CardContent className="p-0">
              <div className="aspect-square relative">
                <img
                  src={image.url}
                  alt={image.original_filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {!selectionMode && (
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingImage(image);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditImage(image);
                      }}
                    >
                      <Edit className="w-4 h-4" />
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
                  {image.original_filename}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatFileSize(image.file_size)} • {image.width}×{image.height}
                </p>
                
                {image.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {image.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {image.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{image.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
                
                {image.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {image.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar imagen</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="tags">Etiquetas (separadas por comas)</Label>
              <Input
                id="tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="producto, categoría, color"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Descripción de la imagen"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingImage(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewingImage?.original_filename}</DialogTitle>
          </DialogHeader>
          
          {viewingImage && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={viewingImage.url}
                  alt={viewingImage.original_filename}
                  className="max-w-full max-h-96 object-contain rounded-lg"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Tamaño:</span> {formatFileSize(viewingImage.file_size)}
                </div>
                <div>
                  <span className="font-medium">Dimensiones:</span> {viewingImage.width}×{viewingImage.height}
                </div>
                <div>
                  <span className="font-medium">Tipo:</span> {viewingImage.mime_type}
                </div>
                <div>
                  <span className="font-medium">Creada:</span> {new Date(viewingImage.created_at).toLocaleDateString()}
                </div>
              </div>
              
              {viewingImage.tags.length > 0 && (
                <div>
                  <span className="font-medium text-sm">Etiquetas:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingImage.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {viewingImage.description && (
                <div>
                  <span className="font-medium text-sm">Descripción:</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {viewingImage.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};