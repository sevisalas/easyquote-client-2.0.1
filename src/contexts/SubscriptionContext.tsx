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
  hasAccessToModule: (module: string) => boolean;
  isAPISubscription: () => boolean;
  isClientSubscription: () => boolean;
  canAccessClientes: () => boolean;
  canAccessPresupuestos: () => boolean;
  canAccessExcel: () => boolean;
  canAccessProductos: () => boolean;
  canAccessCategorias: () => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    console.error('useSubscription must be used within a SubscriptionProvider');
    console.error('Current component trying to use context:', new Error().stack);
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
  console.log('SubscriptionProvider rendering with children:', !!children);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refreshData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      if (!user) {
        setLoading(false);
        return;
      }

      // Verificar si es superadmin
      const isSuperAdminUser = user.email === 'vdp@tradsis.net';
      console.log('Is superadmin?', isSuperAdminUser, 'Email:', user.email);
      setIsSuperAdmin(isSuperAdminUser);

      // Get user's organization (as API user) - solo si no es superadmin
      if (!isSuperAdminUser) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('api_user_id', user.id)
          .maybeSingle();

        // console.log('Organization data:', orgData, 'Error:', orgError);
        setOrganization(orgData as Organization);

        // Get user's membership (as client user)
        const { data: memberData, error: memberError } = await supabase
          .from('organization_members')
          .select(`
            *,
            organization:organizations(*)
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        // console.log('Member data:', memberData, 'Error:', memberError);
        setMembership(memberData as OrganizationMember);
      } else {
        // Los superadmins no necesitan organization ni membership propios
        setOrganization(null);
        setMembership(null);
      }

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

  // Funciones para determinar el tipo de suscripción
  const isAPISubscription = () => {
    const org = organization || membership?.organization;
    return org?.subscription_plan.includes('api') || false;
  };

  const isClientSubscription = () => {
    const org = organization || membership?.organization;
    return org?.subscription_plan.includes('client') || false;
  };

  // Funciones para acceso a módulos específicos
  const canAccessClientes = () => {
    // Los superusuarios NO tienen acceso automático a clientes
    // Solo controlan organizaciones y configuraciones
    
    // Solo suscripciones Client pueden acceder a clientes
    if (!isClientSubscription()) return false;
    
    // En Client, tanto admin como usuario pueden acceder
    return true;
  };

  const canAccessPresupuestos = () => {
    // Los superusuarios NO tienen acceso automático a presupuestos
    // Solo controlan organizaciones y configuraciones
    
    // Solo suscripciones Client pueden acceder a presupuestos
    if (!isClientSubscription()) return false;
    
    // En Client, tanto admin como usuario pueden acceder
    return true;
  };

  const canAccessExcel = () => {
    if (isSuperAdmin) return true;
    
    // Solo API subscriptions o Client admins pueden acceder a Excel
    if (isAPISubscription()) return true;
    if (isClientSubscription() && isOrgAdmin) return true;
    
    return false;
  };

  const canAccessProductos = () => {
    if (isSuperAdmin) return true;
    
    // Solo API subscriptions o Client admins pueden acceder a productos
    if (isAPISubscription()) return true;
    if (isClientSubscription() && isOrgAdmin) return true;
    
    return false;
  };

  const canAccessCategorias = () => {
    if (isSuperAdmin) return true;
    
    // Solo API subscriptions o Client admins pueden acceder a categorías
    if (isAPISubscription()) return true;
    if (isClientSubscription() && isOrgAdmin) return true;
    
    return false;
  };

  const hasAccessToModule = (module: string) => {
    switch (module) {
      case 'clientes':
        return canAccessClientes();
      case 'presupuestos':
        return canAccessPresupuestos();
      case 'excel':
        return canAccessExcel();
      case 'productos':
        return canAccessProductos();
      case 'categorias':
        return canAccessCategorias();
      default:
        return false;
    }
  };

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
        hasAccessToModule,
        isAPISubscription,
        isClientSubscription,
        canAccessClientes,
        canAccessPresupuestos,
        canAccessExcel,
        canAccessProductos,
        canAccessCategorias,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};