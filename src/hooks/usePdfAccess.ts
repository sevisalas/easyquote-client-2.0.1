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

      // Only organization owners (admins) have PDF access, not regular members
      const isOrgOwner = organization !== null;
      
      if (!isOrgOwner) {
        setHasPdfAccess(false);
        setLoading(false);
        return;
      }

      // Get the current user's organization ID
      const orgId = organization?.id;
      
      if (!orgId) {
        setHasPdfAccess(false);
        setLoading(false);
        return;
      }

      // Check if the organization has an active integration
      const { data, error } = await supabase
        .from('organization_integration_access')
        .select('generate_pdfs, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error) {
        // If no integration exists (PGRST116), allow PDF access by default
        if (error.code === 'PGRST116') {
          setHasPdfAccess(true);
        } else {
          console.error('Error checking PDF access:', error);
          setHasPdfAccess(true); // Default to true on errors
        }
      } else {
        // If integration exists and is active, check generate_pdfs flag
        setHasPdfAccess(data?.generate_pdfs === true);
      }
    } catch (error) {
      console.error('Error in checkPdfAccess:', error);
      setHasPdfAccess(true); // Default to true on errors
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
