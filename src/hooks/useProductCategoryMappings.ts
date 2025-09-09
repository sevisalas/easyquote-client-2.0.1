import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ProductCategoryMapping {
  id: string;
  user_id: string;
  easyquote_product_id: string;
  product_name: string;
  category_id?: string;
  subcategory_id?: string;
  created_at: string;
  updated_at: string;
  product_categories?: {
    id: string;
    name: string;
    color: string;
  };
  product_subcategories?: {
    id: string;
    name: string;
  };
}

export interface ProductCategoryMappingData {
  easyquote_product_id: string;
  product_name: string;
  category_id?: string;
  subcategory_id?: string;
}

export const useProductCategoryMappings = () => {
  const queryClient = useQueryClient();

  // Fetch all product category mappings
  const {
    data: mappings = [],
    isLoading: mappingsLoading,
    error: mappingsError
  } = useQuery({
    queryKey: ["product-category-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_category_mappings")
        .select(`
          *,
          product_categories(id, name, color),
          product_subcategories(id, name)
        `)
        .order("product_name");
      
      if (error) throw error;
      return data as ProductCategoryMapping[];
    }
  });

  // Get mapping for a specific product
  const getProductMapping = (easyquoteProductId: string) => {
    return mappings.find(mapping => mapping.easyquote_product_id === easyquoteProductId);
  };

  // Create or update product category mapping
  const upsertMapping = useMutation({
    mutationFn: async (mappingData: ProductCategoryMappingData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check if mapping already exists
      const { data: existing } = await supabase
        .from("product_category_mappings")
        .select("id")
        .eq("user_id", user.id)
        .eq("easyquote_product_id", mappingData.easyquote_product_id)
        .maybeSingle();

      if (existing) {
        // Update existing mapping
        const { data, error } = await supabase
          .from("product_category_mappings")
          .update({
            product_name: mappingData.product_name,
            category_id: mappingData.category_id || null,
            subcategory_id: mappingData.subcategory_id || null
          })
          .eq("id", existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Create new mapping
        const { data, error } = await supabase
          .from("product_category_mappings")
          .insert({
            user_id: user.id,
            easyquote_product_id: mappingData.easyquote_product_id,
            product_name: mappingData.product_name,
            category_id: mappingData.category_id || null,
            subcategory_id: mappingData.subcategory_id || null
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-category-mappings"] });
      toast({
        title: "Categoría asignada",
        description: "La categoría del producto se ha actualizado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo asignar la categoría: " + error.message,
        variant: "destructive"
      });
    }
  });

  // Delete mapping
  const deleteMapping = useMutation({
    mutationFn: async (easyquoteProductId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("product_category_mappings")
        .delete()
        .eq("user_id", user.id)
        .eq("easyquote_product_id", easyquoteProductId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-category-mappings"] });
      toast({
        title: "Categoría eliminada",
        description: "Se ha eliminado la categoría del producto."
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

  return {
    mappings,
    mappingsLoading,
    mappingsError,
    getProductMapping,
    upsertMapping,
    deleteMapping
  };
};