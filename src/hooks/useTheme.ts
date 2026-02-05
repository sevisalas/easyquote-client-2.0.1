import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface OrganizationTheme {
  id: string;
  organization_id: string;
  name: string;
  primary_color: string;
  primary_foreground?: string;
  secondary_color: string;
  secondary_foreground?: string;
  accent_color: string;
  accent_foreground?: string;
  muted_color?: string;
  muted_foreground?: string;
  sidebar_background?: string;
  sidebar_foreground?: string;
  sidebar_accent?: string;
  sidebar_accent_foreground?: string;
  is_active: boolean;
}

export const useTheme = () => {
  const queryClient = useQueryClient();
  const { organization, membership } = useSubscription();
  const orgId = organization?.id || membership?.organization_id;

  const { data: organizationTheme, isLoading: loading } = useQuery({
    queryKey: ['organization-theme', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: themeData, error } = await supabase
        .from('organization_themes')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading theme:', error);
        return null;
      }

      return themeData as OrganizationTheme | null;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutos - temas cambian muy raramente
    refetchOnWindowFocus: false,
  });

  // Aplicar tema cuando cambie
  useEffect(() => {
    applyTheme(organizationTheme);
  }, [organizationTheme]);

  const applyTheme = useCallback((theme: OrganizationTheme | null | undefined) => {
    const root = document.documentElement;

    if (theme) {
      // Primary
      root.style.setProperty('--primary', theme.primary_color);
      if (theme.primary_foreground) {
        root.style.setProperty('--primary-foreground', theme.primary_foreground);
      }
      
      // Secondary
      root.style.setProperty('--secondary', theme.secondary_color);
      if (theme.secondary_foreground) {
        root.style.setProperty('--secondary-foreground', theme.secondary_foreground);
      }
      
      // Accent
      root.style.setProperty('--accent', theme.accent_color);
      if (theme.accent_foreground) {
        root.style.setProperty('--accent-foreground', theme.accent_foreground);
      }
      
      // Muted
      if (theme.muted_color) {
        root.style.setProperty('--muted', theme.muted_color);
      }
      if (theme.muted_foreground) {
        root.style.setProperty('--muted-foreground', theme.muted_foreground);
      }
      
      // Sidebar - siempre establecer valores con defaults para evitar texto invisible
      const sidebarBg = theme.sidebar_background || '0 0% 98%';
      const sidebarFg = theme.sidebar_foreground || '240 5% 26%';
      const sidebarAccent = theme.sidebar_accent || '240 5% 96%';
      const sidebarAccentFg = theme.sidebar_accent_foreground || '240 6% 10%';
      
      root.style.setProperty('--sidebar-background', sidebarBg);
      root.style.setProperty('--sidebar-foreground', sidebarFg);
      root.style.setProperty('--sidebar-accent', sidebarAccent);
      root.style.setProperty('--sidebar-accent-foreground', sidebarAccentFg);
    } else {
      // No corporate theme - remove custom properties so CSS defaults apply
      root.style.removeProperty('--primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--secondary-foreground');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-foreground');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--muted-foreground');
      root.style.removeProperty('--sidebar-background');
      root.style.removeProperty('--sidebar-foreground');
      root.style.removeProperty('--sidebar-accent');
      root.style.removeProperty('--sidebar-accent-foreground');
    }
  }, []);

  const updateOrganizationTheme = async (theme: Partial<OrganizationTheme>) => {
    if (!orgId) throw new Error('No organization found');

    try {
      let result: OrganizationTheme;

      if (organizationTheme) {
        // Update existing theme
        const { data, error } = await supabase
          .from('organization_themes')
          .update(theme)
          .eq('id', organizationTheme.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new theme
        const { data, error } = await supabase
          .from('organization_themes')
          .insert({
            organization_id: orgId,
            ...theme
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Invalidar cache para refrescar
      queryClient.invalidateQueries({ queryKey: ['organization-theme', orgId] });
      return result;
    } catch (error) {
      console.error('Error updating organization theme:', error);
      throw error;
    }
  };

  const resetToOriginalTheme = async () => {
    try {
      if (!organizationTheme) return;

      await supabase
        .from('organization_themes')
        .delete()
        .eq('id', organizationTheme.id);

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ['organization-theme', orgId] });
      
      // Reset CSS variables to default
      applyTheme(null);
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  };

  const reloadTheme = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['organization-theme', orgId] });
  }, [queryClient, orgId]);

  return {
    organizationTheme: organizationTheme ?? null,
    loading,
    updateOrganizationTheme,
    resetToOriginalTheme,
    reloadTheme
  };
};
