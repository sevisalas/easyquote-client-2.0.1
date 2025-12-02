import { useState, useEffect } from "react";
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
  const { organization, membership } = useSubscription();
  const [organizationTheme, setOrganizationTheme] = useState<OrganizationTheme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, [organization, membership]);

  useEffect(() => {
    applyTheme();
  }, [organizationTheme]);

  const loadTheme = async () => {
    try {
      const orgId = organization?.id || membership?.organization_id;
      if (!orgId) {
        setLoading(false);
        return;
      }

      // Load organization theme
      const { data: themeData } = await supabase
        .from('organization_themes')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single();

      if (themeData) {
        setOrganizationTheme(themeData);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = () => {
    const root = document.documentElement;

    // Apply organization theme colors if available
    if (organizationTheme) {
      // Primary
      root.style.setProperty('--primary', organizationTheme.primary_color);
      if (organizationTheme.primary_foreground) {
        root.style.setProperty('--primary-foreground', organizationTheme.primary_foreground);
      }
      
      // Secondary
      root.style.setProperty('--secondary', organizationTheme.secondary_color);
      if (organizationTheme.secondary_foreground) {
        root.style.setProperty('--secondary-foreground', organizationTheme.secondary_foreground);
      }
      
      // Accent
      root.style.setProperty('--accent', organizationTheme.accent_color);
      if (organizationTheme.accent_foreground) {
        root.style.setProperty('--accent-foreground', organizationTheme.accent_foreground);
      }
      
      // Muted
      if (organizationTheme.muted_color) {
        root.style.setProperty('--muted', organizationTheme.muted_color);
      }
      if (organizationTheme.muted_foreground) {
        root.style.setProperty('--muted-foreground', organizationTheme.muted_foreground);
      }
      
      // Sidebar - siempre establecer valores con defaults para evitar texto invisible
      const sidebarBg = organizationTheme.sidebar_background || '0 0% 98%';
      const sidebarFg = organizationTheme.sidebar_foreground || '240 5% 26%';
      const sidebarAccent = organizationTheme.sidebar_accent || '240 5% 96%';
      const sidebarAccentFg = organizationTheme.sidebar_accent_foreground || '240 6% 10%';
      
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
  };

  const updateOrganizationTheme = async (theme: Partial<OrganizationTheme>) => {
    try {
      const orgId = organization?.id || membership?.organization_id;
      if (!orgId) throw new Error('No organization found');

      if (organizationTheme) {
        // Update existing theme
        const { data, error } = await supabase
          .from('organization_themes')
          .update(theme)
          .eq('id', organizationTheme.id)
          .select()
          .single();

        if (error) throw error;
        setOrganizationTheme(data);
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
        setOrganizationTheme(data);
      }
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

      setOrganizationTheme(null);
      
      // Reset CSS variables to default
      const root = document.documentElement;
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
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  };

  return {
    organizationTheme,
    loading,
    updateOrganizationTheme,
    resetToOriginalTheme,
    reloadTheme: loadTheme
  };
};