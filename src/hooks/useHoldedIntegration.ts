import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface HoldedContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  // Add more fields as needed from Holded API
}

export const useHoldedIntegration = () => {
  const [isHoldedActive, setIsHoldedActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const { organization, membership } = useSubscription();

  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    checkHoldedIntegration();
  }, [currentOrganization?.id]);

  const checkHoldedIntegration = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('is_active, configuration')
        .eq('organization_id', currentOrganization.id)
        .eq('integration_type', 'holded')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking Holded integration:', error);
        setIsHoldedActive(false);
      } else {
        const config = data?.configuration as { apiKey?: string } || {};
        const hasApiKey = config.apiKey?.trim();
        setIsHoldedActive(data?.is_active && !!hasApiKey);
      }
    } catch (error) {
      console.error('Error checking Holded integration:', error);
      setIsHoldedActive(false);
    } finally {
      setLoading(false);
    }
  };

  const getHoldedContacts = async (): Promise<HoldedContact[]> => {
    if (!currentOrganization?.id) return [];

    try {
      const { data, error } = await supabase.functions.invoke('holded-contacts', {
        body: { organizationId: currentOrganization.id }
      });

      if (error) {
        console.error('Error fetching Holded contacts:', error);
        return [];
      }

      return data?.contacts || [];
    } catch (error) {
      console.error('Error calling Holded contacts function:', error);
      return [];
    }
  };

  return {
    isHoldedActive,
    loading,
    getHoldedContacts,
    refreshIntegration: checkHoldedIntegration
  };
};