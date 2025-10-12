import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export const usePdfAccess = () => {
  const [hasPdfAccess, setHasPdfAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const { organization, membership, isSuperAdmin } = useSubscription();

  useEffect(() => {
    checkPdfAccess();
  }, [organization, membership, isSuperAdmin]);

  const checkPdfAccess = async () => {
    try {
      // Superadmins always have access
      if (isSuperAdmin) {
        setHasPdfAccess(true);
        setLoading(false);
        return;
      }

      // Get the current user's organization ID
      const orgId = organization?.id || membership?.organization_id;
      
      if (!orgId) {
        setHasPdfAccess(false);
        setLoading(false);
        return;
      }

      // Check if the organization has PDF generation enabled
      const { data, error } = await supabase
        .from('organization_integration_access')
        .select('generate_pdfs, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error) {
        console.error('Error checking PDF access:', error);
        setHasPdfAccess(false);
      } else {
        // Access only if generate_pdfs is true
        setHasPdfAccess(data?.generate_pdfs === true);
      }
    } catch (error) {
      console.error('Error in checkPdfAccess:', error);
      setHasPdfAccess(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    hasPdfAccess,
    loading,
    refreshPdfAccess: checkPdfAccess
  };
};
