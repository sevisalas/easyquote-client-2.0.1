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
      const { data, error } = await supabase.functions.invoke('easyquote-images', {
        method: 'GET'
      });

      if (error) throw error;
      return data as ImageData[];
    },
  });

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async ({ file, tags = [], description }: UploadImageData) => {
      // Validate file
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("El archivo es demasiado grande. Máximo 10MB.");
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF.");
      }

      setUploadProgress(0);

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tags', JSON.stringify(tags));
      if (description) formData.append('description', description);

      const { data, error } = await supabase.functions.invoke('easyquote-images', {
        method: 'POST',
        body: formData
      });

      if (error) throw error;
      
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
      const { error } = await supabase.functions.invoke(`easyquote-images/${imageId}`, {
        method: 'DELETE'
      });

      if (error) throw error;
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

      const { data, error } = await supabase.functions.invoke(`easyquote-images/${imageId}`, {
        method: 'PATCH',
        body: updateData
      });

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