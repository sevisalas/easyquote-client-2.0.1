import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProductionBoardView = 'list' | 'compact' | 'kanban';

export const useProductionBoardView = () => {
  const queryClient = useQueryClient();

  const { data: view, isLoading } = useQuery({
    queryKey: ["production-board-view"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("production_board_view")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      
      // Default to 'kanban' if not set
      return (profile?.production_board_view || 'kanban') as ProductionBoardView;
    },
  });

  const updateView = useMutation({
    mutationFn: async (newView: ProductionBoardView) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("profiles")
        .update({ production_board_view: newView })
        .eq("user_id", user.id);

      if (error) throw error;
      return newView;
    },
    onSuccess: (newView) => {
      queryClient.setQueryData(["production-board-view"], newView);
      toast.success("Vista guardada como predeterminada");
    },
    onError: (error) => {
      console.error("Error updating view preference:", error);
      toast.error("Error al guardar la preferencia de vista");
    },
  });

  return {
    view: view || 'kanban',
    isLoading,
    updateView: updateView.mutate,
  };
};
