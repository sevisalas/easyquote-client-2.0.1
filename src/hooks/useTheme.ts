import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface OrganizationTheme {
  id: string;
  organization_id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  muted_color?: string;
  is_active: boolean;
}

export type ThemeVariant = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const { organization, membership } = useSubscription();
  const [organizationTheme, setOrganizationTheme] = useState<OrganizationTheme | null>(null);
  const [userVariant, setUserVariant] = useState<ThemeVariant>('light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, [organization, membership]);

  useEffect(() => {
    applyTheme();
  }, [organizationTheme, userVariant]);

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

      // Load user variant preference
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('selected_theme')
          .eq('user_id', user.id)
          .single();

        if (profileData?.selected_theme) {
          setUserVariant(profileData.selected_theme as ThemeVariant);
        }
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse and adjust HSL color
  const adjustColorForDarkMode = (hslString: string, lightnessAdjust: number) => {
    const parts = hslString.replace(/%/g, '').split(' ').map(v => parseFloat(v));
    if (parts.length === 3) {
      const [h, s, l] = parts;
      const newLightness = Math.max(Math.min(l + lightnessAdjust, 80), 20);
      return `${h} ${s}% ${newLightness}%`;
    }
    return hslString;
  };

  const applyTheme = () => {
    const root = document.documentElement;
    
    // Determine if we should use dark mode
    const isDark = userVariant === 'dark' || 
      (userVariant === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // First, remove any custom properties to let CSS defaults work
    root.style.removeProperty('--primary');
    root.style.removeProperty('--secondary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--muted');
    root.style.removeProperty('--primary-foreground');
    root.style.removeProperty('--secondary-foreground');
    root.style.removeProperty('--accent-foreground');
    
    // Toggle dark class
    root.classList.toggle('dark', isDark);

    // Apply organization theme colors if available
    if (organizationTheme) {
      if (isDark) {
        // For dark mode, lighten colors for better visibility on dark backgrounds
        root.style.setProperty('--primary', adjustColorForDarkMode(organizationTheme.primary_color, 20));
        root.style.setProperty('--primary-foreground', '0 0% 0%');
        
        // Adjust secondary - make it darker for dark mode backgrounds
        root.style.setProperty('--secondary', adjustColorForDarkMode(organizationTheme.secondary_color, -30));
        root.style.setProperty('--secondary-foreground', '0 0% 98%');
        
        // Adjust accent for dark mode
        root.style.setProperty('--accent', adjustColorForDarkMode(organizationTheme.accent_color, 15));
        root.style.setProperty('--accent-foreground', '0 0% 98%');
        
        if (organizationTheme.muted_color) {
          root.style.setProperty('--muted', adjustColorForDarkMode(organizationTheme.muted_color, -20));
        }
      } else {
        // Light mode - apply organization colors directly
        root.style.setProperty('--primary', organizationTheme.primary_color);
        root.style.setProperty('--secondary', organizationTheme.secondary_color);
        root.style.setProperty('--accent', organizationTheme.accent_color);
        
        if (organizationTheme.muted_color) {
          root.style.setProperty('--muted', organizationTheme.muted_color);
        }
      }
    }
  };

  const updateUserVariant = async (variant: ThemeVariant) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ selected_theme: variant })
        .eq('user_id', user.id);

      setUserVariant(variant);
    } catch (error) {
      console.error('Error updating user variant:', error);
      throw error;
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
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--muted');
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  };

  return {
    organizationTheme,
    userVariant,
    loading,
    updateUserVariant,
    updateOrganizationTheme,
    resetToOriginalTheme,
    reloadTheme: loadTheme
  };
};
