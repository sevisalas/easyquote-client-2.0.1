import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ProductCategory {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductSubcategory {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_categories?: ProductCategory;
}

export interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

export interface SubcategoryFormData {
  name: string;
  description: string;
  category_id: string;
  is_active: boolean;
}

export const useProductCategories = () => {
  const queryClient = useQueryClient();

  // Fetch categories
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    error: categoriesError
  } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as ProductCategory[];
    }
  });

  // Fetch subcategories
  const {
    data: subcategories = [],
    isLoading: subcategoriesLoading,
    error: subcategoriesError
  } = useQuery({
    queryKey: ["product-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_subcategories")
        .select(`
          *,
          product_categories(*)
        `)
        .order("name");
      
      if (error) throw error;
      return data as ProductSubcategory[];
    }
  });

  // Create category mutation
  const createCategory = useMutation({
    mutationFn: async (categoryData: CategoryFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("product_categories")
        .insert({
          user_id: user.id,
          ...categoryData
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast({
        title: "Categoría creada",
        description: "La categoría se ha creado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo crear la categoría: " + error.message,
        variant: "destructive"
      });
    }
  });

  // Update category mutation
  const updateCategory = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CategoryFormData> }) => {
      const { data: result, error } = await supabase
        .from("product_categories")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast({
        title: "Categoría actualizada",
        description: "La categoría se ha actualizado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la categoría: " + error.message,
        variant: "destructive"
      });
    }
  });

  // Delete category mutation
  const deleteCategory = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", categoryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      queryClient.invalidateQueries({ queryKey: ["product-subcategories"] });
      toast({
        title: "Categoría eliminada",
        description: "La categoría se ha eliminado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la categoría: " + error.message,
        variant: "destructive"
      });
    }
  });

  // Create subcategory mutation
  const createSubcategory = useMutation({
    mutationFn: async (subcategoryData: SubcategoryFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("product_subcategories")
        .insert({
          user_id: user.id,
          ...subcategoryData
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-subcategories"] });
      toast({
        title: "Subcategoría creada",
        description: "La subcategoría se ha creado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo crear la subcategoría: " + error.message,
        variant: "destructive"
      });
    }
  });

  // Update subcategory mutation
  const updateSubcategory = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubcategoryFormData> }) => {
      const { data: result, error } = await supabase
        .from("product_subcategories")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-subcategories"] });
      toast({
        title: "Subcategoría actualizada",
        description: "La subcategoría se ha actualizado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la subcategoría: " + error.message,
        variant: "destructive"
      });
    }
  });

  // Delete subcategory mutation
  const deleteSubcategory = useMutation({
    mutationFn: async (subcategoryId: string) => {
      const { error } = await supabase
        .from("product_subcategories")
        .delete()
        .eq("id", subcategoryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-subcategories"] });
      toast({
        title: "Subcategoría eliminada",
        description: "La subcategoría se ha eliminado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la subcategoría: " + error.message,
        variant: "destructive"
      });
    }
  });

  return {
    // Data
    categories,
    subcategories,
    
    // Loading states
    categoriesLoading,
    subcategoriesLoading,
    
    // Error states
    categoriesError,
    subcategoriesError,
    
    // Mutations
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory
  };
};