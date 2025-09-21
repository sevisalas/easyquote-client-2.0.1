import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageGallery } from "@/components/images/ImageGallery";
import { ImageUploader } from "@/components/images/ImageUploader";
import { useImageManagement } from "@/hooks/useImageManagement";

export default function ImageManagement() {
  const { images, isLoading } = useImageManagement();

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Imágenes</h1>
        <p className="text-muted-foreground">
          Administra tus imágenes para usar en productos y presupuestos
        </p>
      </div>

      <Tabs defaultValue="gallery" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="gallery">
            Galería ({images.length})
          </TabsTrigger>
          <TabsTrigger value="upload">Subir imágenes</TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Galería de imágenes</CardTitle>
              <CardDescription>
                Gestiona tus imágenes subidas. Puedes editar etiquetas, descripciones y eliminar imágenes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageGallery />
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
      </Tabs>
    </div>
  );
}