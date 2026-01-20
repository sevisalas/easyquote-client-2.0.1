import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageSubcategory {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export const useImageSubcategories = () => {
  const queryClient = useQueryClient();
  const organizationId = sessionStorage.getItem("selected_organization_id") || null;

  const { data: subcategories = [], isLoading } = useQuery({
    queryKey: ["image-subcategories", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("image_subcategories")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      return data as ImageSubcategory[];
    },
    enabled: !!organizationId,
  });

  // Get subcategories for a specific category
  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter((sub) => sub.category_id === categoryId);
  };

  const createSubcategoryMutation = useMutation({
    mutationFn: async ({
      categoryId,
      name,
      description,
    }: {
      categoryId: string;
      name: string;
      description?: string;
    }) => {
      if (!organizationId) throw new Error("No hay organización seleccionada");

      const { data, error } = await supabase
        .from("image_subcategories")
        .insert({
          category_id: categoryId,
          name,
          description,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-subcategories", organizationId] });
      toast.success("Subcategoría creada");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Ya existe una subcategoría con ese nombre en esta categoría");
      } else {
        toast.error(error.message || "Error al crear subcategoría");
      }
    },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      description,
    }: {
      id: string;
      name?: string;
      description?: string;
    }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("image_subcategories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-subcategories", organizationId] });
      toast.success("Subcategoría actualizada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar subcategoría");
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("image_subcategories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-subcategories", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["image-category-assignments", organizationId] });
      toast.success("Subcategoría eliminada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar subcategoría");
    },
  });

  return {
    subcategories,
    isLoading,
    getSubcategoriesForCategory,
    createSubcategory: createSubcategoryMutation.mutate,
    updateSubcategory: updateSubcategoryMutation.mutate,
    deleteSubcategory: deleteSubcategoryMutation.mutate,
    isCreating: createSubcategoryMutation.isPending,
    isUpdating: updateSubcategoryMutation.isPending,
    isDeleting: deleteSubcategoryMutation.isPending,
  };
};
