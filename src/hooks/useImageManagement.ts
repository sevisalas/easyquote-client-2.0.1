import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Interface adapted for EasyQuote API response
export interface ImageData {
  id: string;

  // EasyQuote list fields
  name?: string;
  smallImage?: string;
  mediumImage?: string;
  dateCreated?: string;

  // Local-app friendly aliases
  filename?: string;
  original_filename?: string;
  url?: string;

  // Optional variants structure used by UI
  variants?: {
    original?: Record<string, string | undefined>;
    square?: Record<string, string | undefined>;
  };

  // Local-only metadata (when available)
  file_size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
}

type EasyQuoteImageListItem = {
  id: string;
  name?: string;
  dateCreated?: string;
  smallImage?: string;
  mediumImage?: string;
};

function normalizeEasyQuoteImage(item: any): ImageData {
  const i = item as EasyQuoteImageListItem;
  const filename = i?.name;
  const url = i?.mediumImage || i?.smallImage;

  return {
    ...item,
    id: i.id,
    name: i.name,
    dateCreated: i.dateCreated,
    smallImage: i.smallImage,
    mediumImage: i.mediumImage,

    // aliases expected by the UI
    filename: filename,
    original_filename: filename,
    url,

    // minimal variants so the dialog/gallery can show something
    variants: {
      original: {
        small: i.smallImage,
        medium: i.mediumImage,
      },
    },
  };
}

function normalizeEasyQuoteImageList(data: any): ImageData[] {
  if (!Array.isArray(data)) return [];
  return data.filter(Boolean).map(normalizeEasyQuoteImage);
}

interface UploadImageData {
  file: File;
  tags?: string[];
  description?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const useImageManagement = () => {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const organizationId = sessionStorage.getItem("selected_organization_id") || null;
  const easyquoteToken = sessionStorage.getItem("easyquote_token") || null;
  
  const orgHeaders: Record<string, string> = {
    ...(organizationId && { "X-Organization-Id": organizationId }),
    ...(easyquoteToken && { "X-EasyQuote-Token": easyquoteToken }),
  };

  // Fetch organization images
  const { data: imagesRaw, isLoading, error } = useQuery({
    queryKey: ["user-images", organizationId],
    queryFn: async () => {
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // Use direct fetch with GET - supabase.functions.invoke always sends POST
      const response = await fetch(
        "https://xrjwvvemxfzmeogaptzz.supabase.co/functions/v1/easyquote-images",
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            ...orgHeaders,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const images = normalizeEasyQuoteImageList(imagesRaw);

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async ({ file }: UploadImageData) => {
      // Validate file
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("El archivo es demasiado grande. Máximo 10MB.");
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF.");
      }

      setUploadProgress(0);

      // Create form data - only file, EasyQuote API doesn't support tags/description
      const formData = new FormData();
      formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("easyquote-images", {
        method: "POST",
        body: formData,
        headers: orgHeaders,
      });

      if (error) throw error;

      setUploadProgress(100);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-images", organizationId] });
      toast.success("Imagen subida a EasyQuote correctamente");
      setUploadProgress(0);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al subir la imagen a EasyQuote");
      setUploadProgress(0);
    },
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await supabase.functions.invoke(`easyquote-images/${imageId}`, {
        method: "DELETE",
        headers: orgHeaders,
      });

      if (error) throw error;
      return imageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-images", organizationId] });
      toast.success("Imagen eliminada de EasyQuote correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar la imagen de EasyQuote");
    },
  });

  // Fetch single image details
  const fetchImageDetails = async (imageId: string) => {
    const { data, error } = await supabase.functions.invoke("easyquote-images", {
      body: { action: "get", imageId },
      headers: orgHeaders,
    });

    if (error) throw error;
    return data ? normalizeEasyQuoteImage(data) : null;
  };

  return {
    images,
    isLoading,
    error,
    uploadProgress,
    uploadImage: uploadImageMutation.mutate,
    deleteImage: deleteImageMutation.mutate,
    fetchImageDetails,
    isUploading: uploadImageMutation.isPending,
    isDeleting: deleteImageMutation.isPending,
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