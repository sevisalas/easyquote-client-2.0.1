import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface OrganizationTheme {
  id: string;
  organization_id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  muted_color?: string;
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

  // Helper to determine if a color is light or dark based on HSL lightness
  const isLightColor = (hslString: string): boolean => {
    const parts = hslString.replace(/%/g, '').split(' ').map(v => parseFloat(v));
    if (parts.length === 3) {
      return parts[2] > 50; // Lightness > 50% = light color
    }
    return false;
  };

  const applyTheme = () => {
    const root = document.documentElement;

    // Apply organization theme colors if available
    if (organizationTheme) {
      // Apply corporate colors exactly as configured
      root.style.setProperty('--primary', organizationTheme.primary_color);
      root.style.setProperty('--secondary', organizationTheme.secondary_color);
      root.style.setProperty('--accent', organizationTheme.accent_color);
      
      // Set appropriate foreground colors based on luminosity
      const primaryFg = isLightColor(organizationTheme.primary_color) ? '0 0% 0%' : '0 0% 100%';
      const secondaryFg = isLightColor(organizationTheme.secondary_color) ? '0 0% 0%' : '0 0% 100%';
      const accentFg = isLightColor(organizationTheme.accent_color) ? '0 0% 0%' : '0 0% 100%';
      
      root.style.setProperty('--primary-foreground', primaryFg);
      root.style.setProperty('--secondary-foreground', secondaryFg);
      root.style.setProperty('--accent-foreground', accentFg);
      
      if (organizationTheme.muted_color) {
        root.style.setProperty('--muted', organizationTheme.muted_color);
      }
    } else {
      // No corporate theme - remove custom properties so CSS defaults apply
      root.style.removeProperty('--primary');
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--secondary-foreground');
      root.style.removeProperty('--accent-foreground');
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
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--secondary-foreground');
      root.style.removeProperty('--accent-foreground');
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