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

      // Solo los propietarios de organizaciones y admins tienen acceso a plantillas PDF
      // Los usuarios normales (organization_members sin rol admin) NO tienen acceso
      const isOrgOwner = organization !== null;
      const isOrgAdmin = membership?.role === 'admin';
      
      if (!isOrgOwner && !isOrgAdmin) {
        setHasPdfAccess(false);
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

      // Check if the organization has an active integration
      const { data, error } = await supabase
        .from('organization_integration_access')
        .select('generate_pdfs, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking PDF access:', error);
        setHasPdfAccess(false); // Default to false on errors for security
      } else if (!data) {
        // If no integration exists, allow PDF access for admins by default
        setHasPdfAccess(true);
      } else {
        // If integration exists and is active, check generate_pdfs flag
        setHasPdfAccess(data?.generate_pdfs === true);
      }
    } catch (error) {
      console.error('Error in checkPdfAccess:', error);
      setHasPdfAccess(false); // Default to false on errors for security
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
