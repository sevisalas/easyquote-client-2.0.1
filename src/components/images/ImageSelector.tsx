import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Plus } from "lucide-react";
import { ImageGallery } from "./ImageGallery";
import { ImageUploader } from "./ImageUploader";
import { ImageData } from "@/hooks/useImageManagement";

interface ImageSelectorProps {
  selectedImage?: ImageData | null;
  onImageSelect: (image: ImageData | null) => void;
  triggerText?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
}

export const ImageSelector: React.FC<ImageSelectorProps> = ({
  selectedImage,
  onImageSelect,
  triggerText = "Seleccionar imagen",
  triggerVariant = "outline",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("gallery");

  const handleImageSelect = (image: ImageData) => {
    onImageSelect(image);
    setIsOpen(false);
  };

  const handleUploadComplete = () => {
    // Switch to gallery tab after upload to see the new image
    setActiveTab("gallery");
  };

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant={triggerVariant} className="w-full">
            {selectedImage ? (
              <div className="flex items-center space-x-2">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.original_filename}
                  className="w-6 h-6 rounded object-cover"
                />
                <span className="truncate">{selectedImage.original_filename}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4" />
                <span>{triggerText}</span>
              </div>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Seleccionar imagen</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="gallery">Galería</TabsTrigger>
              <TabsTrigger value="upload">Subir nueva</TabsTrigger>
            </TabsList>

            <TabsContent value="gallery" className="mt-4 h-full overflow-y-auto">
              <div className="space-y-4">
                {selectedImage && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <img
                        src={selectedImage.url}
                        alt={selectedImage.original_filename}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div>
                        <p className="font-medium">{selectedImage.original_filename}</p>
                        <p className="text-sm text-muted-foreground">Imagen seleccionada</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onImageSelect(null);
                        setIsOpen(false);
                      }}
                    >
                      Quitar selección
                    </Button>
                  </div>
                )}

                <ImageGallery
                  onImageSelect={handleImageSelect}
                  selectedImageId={selectedImage?.id}
                  selectionMode={true}
                />
              </div>
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <div className="space-y-4">
                <ImageUploader
                  onUploadComplete={handleUploadComplete}
                  multiple={false}
                />
                
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Después de subir, ve a la pestaña "Galería" para seleccionar la imagen
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};