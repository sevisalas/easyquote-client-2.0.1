import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageCategoryAssignment {
  id: string;
  easyquote_image_id: string;
  category_id: string;
  subcategory_id: string | null;
  organization_id: string;
  created_at: string;
}

export const useImageCategoryAssignments = () => {
  const queryClient = useQueryClient();
  const organizationId = sessionStorage.getItem("selected_organization_id") || null;

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["image-category-assignments", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("image_category_assignments")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;
      return data as ImageCategoryAssignment[];
    },
    enabled: !!organizationId,
  });

  const getCategoryForImage = (imageId: string): string | null => {
    const assignment = assignments.find((a) => a.easyquote_image_id === imageId);
    return assignment?.category_id || null;
  };

  const getSubcategoryForImage = (imageId: string): string | null => {
    const assignment = assignments.find((a) => a.easyquote_image_id === imageId);
    return assignment?.subcategory_id || null;
  };

  const getImagesForCategory = (categoryId: string): string[] => {
    return assignments
      .filter((a) => a.category_id === categoryId)
      .map((a) => a.easyquote_image_id);
  };

  const getImagesForSubcategory = (subcategoryId: string): string[] => {
    return assignments
      .filter((a) => a.subcategory_id === subcategoryId)
      .map((a) => a.easyquote_image_id);
  };

  const assignCategoryMutation = useMutation({
    mutationFn: async ({
      imageId,
      categoryId,
      subcategoryId,
    }: {
      imageId: string;
      categoryId: string | null;
      subcategoryId?: string | null;
    }) => {
      if (!organizationId) throw new Error("No hay organización seleccionada");

      if (categoryId === null) {
        const { error } = await supabase
          .from("image_category_assignments")
          .delete()
          .eq("easyquote_image_id", imageId)
          .eq("organization_id", organizationId);

        if (error) throw error;
        return null;
      }

      const { data, error } = await supabase
        .from("image_category_assignments")
        .upsert(
          {
            easyquote_image_id: imageId,
            category_id: categoryId,
            subcategory_id: subcategoryId || null,
            organization_id: organizationId,
          },
          {
            onConflict: "easyquote_image_id,organization_id",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["image-category-assignments", organizationId],
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al asignar categoría");
    },
  });

  return {
    assignments,
    isLoading,
    getCategoryForImage,
    getSubcategoryForImage,
    getImagesForCategory,
    getImagesForSubcategory,
    assignCategory: assignCategoryMutation.mutate,
    isAssigning: assignCategoryMutation.isPending,
  };
};
