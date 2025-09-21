import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageData {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  storage_path: string;
  tags: string[];
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  url?: string;
}

interface UploadImageData {
  file: File;
  tags?: string[];
  description?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const useImageManagement = () => {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Fetch user images
  const { data: images = [], isLoading, error } = useQuery({
    queryKey: ["user-images"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("images")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get public URLs for images
      const imagesWithUrls = await Promise.all(
        data.map(async (image) => {
          const { data: urlData } = supabase.storage
            .from("product-images")
            .getPublicUrl(image.storage_path);
          
          return {
            ...image,
            url: urlData.publicUrl
          };
        })
      );

      return imagesWithUrls as ImageData[];
    },
  });

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async ({ file, tags = [], description }: UploadImageData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Validate file
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("El archivo es demasiado grande. Máximo 10MB.");
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF.");
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      setUploadProgress(0);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get image dimensions
      const dimensions = await getImageDimensions(file);

      // Save metadata to database
      const { data, error: dbError } = await supabase
        .from("images")
        .insert({
          user_id: user.id,
          filename: fileName.split('/').pop() || fileName,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          width: dimensions.width,
          height: dimensions.height,
          storage_path: fileName,
          tags,
          description,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadProgress(100);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-images"] });
      toast.success("Imagen subida correctamente");
      setUploadProgress(0);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al subir la imagen");
      setUploadProgress(0);
    },
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const image = images.find(img => img.id === imageId);
      if (!image) throw new Error("Imagen no encontrada");

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("product-images")
        .remove([image.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("images")
        .delete()
        .eq("id", imageId);

      if (dbError) throw dbError;

      return imageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-images"] });
      toast.success("Imagen eliminada correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar la imagen");
    },
  });

  // Update image metadata mutation
  const updateImageMutation = useMutation({
    mutationFn: async ({ 
      imageId, 
      tags, 
      description 
    }: { 
      imageId: string; 
      tags?: string[]; 
      description?: string; 
    }) => {
      const updateData: any = {};
      if (tags !== undefined) updateData.tags = tags;
      if (description !== undefined) updateData.description = description;

      const { data, error } = await supabase
        .from("images")
        .update(updateData)
        .eq("id", imageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-images"] });
      toast.success("Imagen actualizada correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar la imagen");
    },
  });

  return {
    images,
    isLoading,
    error,
    uploadProgress,
    uploadImage: uploadImageMutation.mutate,
    deleteImage: deleteImageMutation.mutate,
    updateImage: updateImageMutation.mutate,
    isUploading: uploadImageMutation.isPending,
    isDeleting: deleteImageMutation.isPending,
    isUpdating: updateImageMutation.isPending,
  };
};

// Helper function to get image dimensions
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    
    img.src = url;
  });
}