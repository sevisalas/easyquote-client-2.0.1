import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SubscriptionPlan = 'api_base' | 'api_pro' | 'client_base' | 'client_pro' | 'custom';
type OrganizationRole = 'superadmin' | 'admin' | 'user';

interface Organization {
  id: string;
  name: string;
  subscription_plan: SubscriptionPlan;
  excel_limit: number;
  excel_extra: number;
  client_user_limit: number;
  client_user_extra: number;
  api_user_id: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  organization?: Organization;
}

interface SubscriptionContextType {
  organization: Organization | null;
  membership: OrganizationMember | null;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  loading: boolean;
  refreshData: () => Promise<void>;
  hasClientAccess: () => boolean;
  getRemainingExcelLimit: () => number;
  getRemainingUserLimit: () => number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refreshData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Verificar si es superadmin
      setIsSuperAdmin(user.email === 'vdp@tradsis.net');

      // Get user's organization (as API user)
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('api_user_id', user.id)
        .single();

      setOrganization(orgData);

      // Get user's membership (as client user)
      const { data: memberData } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', user.id)
        .single();

      setMembership(memberData);

    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshData();
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasClientAccess = () => {
    return organization?.subscription_plan.includes('client') || 
           membership?.organization?.subscription_plan.includes('client') ||
           false;
  };

  const getRemainingExcelLimit = () => {
    const org = organization || membership?.organization;
    if (!org) return 0;
    return org.excel_limit + org.excel_extra;
  };

  const getRemainingUserLimit = () => {
    const org = organization || membership?.organization;
    if (!org) return 0;
    return org.client_user_limit + org.client_user_extra;
  };

  const isOrgAdmin = organization !== null || membership?.role === 'admin' || isSuperAdmin;

  return (
    <SubscriptionContext.Provider
      value={{
        organization,
        membership,
        isSuperAdmin,
        isOrgAdmin,
        loading,
        refreshData,
        hasClientAccess,
        getRemainingExcelLimit,
        getRemainingUserLimit,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};