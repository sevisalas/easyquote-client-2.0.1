import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Theme = "default" | "ocean" | "forest" | "sunset" | "midnight" | null;

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_theme")
        .eq("user_id", user.id)
        .single();

      if (profile?.selected_theme) {
        const savedTheme = profile.selected_theme as Theme;
        setTheme(savedTheme);
        applyTheme(savedTheme);
      }
    } catch (error) {
      console.error("Error loading theme:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (newTheme: Theme) => {
    if (newTheme && newTheme !== "default") {
      document.documentElement.setAttribute("data-theme", newTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  const updateTheme = async (newTheme: Theme) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Debes estar autenticado para cambiar el tema",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ selected_theme: newTheme })
        .eq("user_id", user.id);

      if (error) throw error;

      setTheme(newTheme);
      applyTheme(newTheme);

      toast({
        title: "Tema actualizado",
        description: "El tema se ha cambiado correctamente",
      });
    } catch (error) {
      console.error("Error updating theme:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el tema",
        variant: "destructive",
      });
    }
  };

  return {
    theme,
    updateTheme,
    isLoading,
  };
}
