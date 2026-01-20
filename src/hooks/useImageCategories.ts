import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImageCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export const useImageCategories = () => {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["image-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as ImageCategory[];
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async ({ name, description, color }: { name: string; description?: string; color?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data, error } = await supabase
        .from("image_categories")
        .insert({
          user_id: user.id,
          name,
          description,
          color: color || "#6366f1",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-categories"] });
      toast.success("Categoría creada");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Ya existe una categoría con ese nombre");
      } else {
        toast.error(error.message || "Error al crear categoría");
      }
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name, description, color }: { id: string; name?: string; description?: string; color?: string }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;

      const { data, error } = await supabase
        .from("image_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-categories"] });
      toast.success("Categoría actualizada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar categoría");
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("image_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-categories"] });
      queryClient.invalidateQueries({ queryKey: ["user-images"] });
      toast.success("Categoría eliminada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar categoría");
    },
  });

  return {
    categories,
    isLoading,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
  };
};
