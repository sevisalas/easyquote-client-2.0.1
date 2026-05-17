import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface OrganizationTheme {
  id: string;
  organization_id: string;
  name: string;
  mode?: 'light' | 'dark';
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

export type ThemeMode = 'light' | 'dark';

export const useTheme = () => {
  const queryClient = useQueryClient();
  const { organization, membership } = useSubscription();
  const orgId = organization?.id || membership?.organization_id;

  const { data: themes, isLoading: loading } = useQuery({
    queryKey: ['organization-theme', orgId],
    queryFn: async () => {
      if (!orgId) return [] as OrganizationTheme[];

      const { data: themeData, error } = await supabase
        .from('organization_themes')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      if (error) {
        console.error('Error loading theme:', error);
        return [] as OrganizationTheme[];
      }

      return (themeData ?? []) as OrganizationTheme[];
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutos - temas cambian muy raramente
    refetchOnWindowFocus: false,
  });

  const lightTheme = useMemo(
    () => (themes ?? []).find(t => (t.mode ?? 'light') === 'light') ?? null,
    [themes]
  );
  const darkTheme = useMemo(
    () => (themes ?? []).find(t => t.mode === 'dark') ?? null,
    [themes]
  );

  // Apply theme matching current dark/light mode
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? (darkTheme ?? null) : (lightTheme ?? null), isDark);
  }, [lightTheme, darkTheme]);

  // Re-apply when dark mode class on <html> toggles
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(isDark ? (darkTheme ?? null) : (lightTheme ?? null), isDark);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [lightTheme, darkTheme]);

  const applyTheme = useCallback((theme: OrganizationTheme | null | undefined, isDark: boolean) => {
    const root = document.documentElement;

    if (theme) {
      root.style.setProperty('--primary', theme.primary_color);
      if (theme.primary_foreground) {
        root.style.setProperty('--primary-foreground', theme.primary_foreground);
      }

      root.style.setProperty('--secondary', theme.secondary_color);
      if (theme.secondary_foreground) {
        root.style.setProperty('--secondary-foreground', theme.secondary_foreground);
      }

      root.style.setProperty('--accent', theme.accent_color);
      if (theme.accent_foreground) {
        root.style.setProperty('--accent-foreground', theme.accent_foreground);
      }

      if (theme.muted_color) {
        root.style.setProperty('--muted', theme.muted_color);
      }
      if (theme.muted_foreground) {
        root.style.setProperty('--muted-foreground', theme.muted_foreground);
      }

      // Sidebar - safe defaults to avoid invisible text
      const defaults = isDark
        ? { bg: '240 10% 8%', fg: '0 0% 95%', accent: '240 6% 14%', accentFg: '0 0% 95%' }
        : { bg: '0 0% 98%', fg: '240 5% 26%', accent: '240 5% 96%', accentFg: '240 6% 10%' };
      const sidebarBg = theme.sidebar_background || defaults.bg;
      const sidebarFg = theme.sidebar_foreground || defaults.fg;
      const sidebarAccent = theme.sidebar_accent || defaults.accent;
      const sidebarAccentFg = theme.sidebar_accent_foreground || defaults.accentFg;

      root.style.setProperty('--sidebar-background', sidebarBg);
      root.style.setProperty('--sidebar-foreground', sidebarFg);
      root.style.setProperty('--sidebar-accent', sidebarAccent);
      root.style.setProperty('--sidebar-accent-foreground', sidebarAccentFg);
    } else {
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

  const updateOrganizationTheme = async (
    theme: Partial<OrganizationTheme>,
    mode: ThemeMode = 'light'
  ) => {
    if (!orgId) throw new Error('No organization found');

    try {
      let result: OrganizationTheme;
      const existing = (themes ?? []).find(t => (t.mode ?? 'light') === mode) ?? null;

      if (existing) {
        const { data, error } = await supabase
          .from('organization_themes')
          .update({ ...theme, mode })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('organization_themes')
          .insert({
            organization_id: orgId,
            ...theme,
            mode,
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      queryClient.invalidateQueries({ queryKey: ['organization-theme', orgId] });
      return result;
    } catch (error) {
      console.error('Error updating organization theme:', error);
      throw error;
    }
  };

  const resetToOriginalTheme = async (mode: ThemeMode = 'light') => {
    try {
      const existing = (themes ?? []).find(t => (t.mode ?? 'light') === mode) ?? null;
      if (!existing) return;

      await supabase
        .from('organization_themes')
        .delete()
        .eq('id', existing.id);

      queryClient.invalidateQueries({ queryKey: ['organization-theme', orgId] });
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(null, isDark);
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  };

  const reloadTheme = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['organization-theme', orgId] });
  }, [queryClient, orgId]);

  return {
    organizationTheme: lightTheme,
    lightTheme,
    darkTheme,
    loading,
    updateOrganizationTheme,
    resetToOriginalTheme,
    reloadTheme
  };
};
