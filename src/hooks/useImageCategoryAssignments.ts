import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageCategoryAssignment {
  id: string;
  easyquote_image_id: string;
  category_id: string;
  organization_id: string;
  created_at: string;
}

export const useImageCategoryAssignments = () => {
  const queryClient = useQueryClient();
  const organizationId = sessionStorage.getItem("selected_organization_id") || null;

  // Fetch all assignments for the organization
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

  // Get category for a specific image
  const getCategoryForImage = (imageId: string): string | null => {
    const assignment = assignments.find((a) => a.easyquote_image_id === imageId);
    return assignment?.category_id || null;
  };

  // Get all images for a specific category
  const getImagesForCategory = (categoryId: string): string[] => {
    return assignments
      .filter((a) => a.category_id === categoryId)
      .map((a) => a.easyquote_image_id);
  };

  // Assign or update category for an image
  const assignCategoryMutation = useMutation({
    mutationFn: async ({
      imageId,
      categoryId,
    }: {
      imageId: string;
      categoryId: string | null;
    }) => {
      if (!organizationId) throw new Error("No hay organización seleccionada");

      if (categoryId === null) {
        // Remove assignment
        const { error } = await supabase
          .from("image_category_assignments")
          .delete()
          .eq("easyquote_image_id", imageId)
          .eq("organization_id", organizationId);

        if (error) throw error;
        return null;
      }

      // Upsert assignment
      const { data, error } = await supabase
        .from("image_category_assignments")
        .upsert(
          {
            easyquote_image_id: imageId,
            category_id: categoryId,
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
    getImagesForCategory,
    assignCategory: assignCategoryMutation.mutate,
    isAssigning: assignCategoryMutation.isPending,
  };
};
