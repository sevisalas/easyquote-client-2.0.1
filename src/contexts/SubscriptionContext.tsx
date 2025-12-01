import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SubscriptionPlan = 'api' | 'client' | 'erp' | 'custom' | 'api_base' | 'api_pro' | 'client_base' | 'client_pro';
type OrganizationRole = 'admin' | 'gestor' | 'comercial' | 'operador';

interface Organization {
  id: string;
  name: string;
  subscription_plan: SubscriptionPlan;
  excel_limit: number;
  excel_extra: number;
  client_user_limit: number;
  client_user_extra: number;
  api_user_id: string;
  holded_external_customers?: boolean;
  max_daily_orders?: number;
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
  isERPSubscription: () => boolean;
  canAccessClientes: () => boolean;
  canAccessPresupuestos: () => boolean;
  canAccessExcel: () => boolean;
  canAccessProductos: () => boolean;
  canAccessCategorias: () => boolean;
  canAccessProduccion: () => boolean;
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
      console.log('🔐 Current user:', user?.id);
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user has superadmin role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      console.log('👥 User roles:', roles, 'Error:', rolesError);
      
      const isSuperAdminUser = roles?.some(r => r.role === 'superadmin') || false;
      console.log('🔑 Is superadmin?', isSuperAdminUser);
      setIsSuperAdmin(isSuperAdminUser);

      // Get user's organization (as API user) - solo si no es superadmin
      if (!isSuperAdminUser) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('api_user_id', user.id)
          .maybeSingle();

        console.log('🏢 Organization as owner:', orgData, 'Error:', orgError);
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

        console.log('👤 Member data:', memberData, 'Error:', memberError);
        console.log('📊 Member organization:', memberData?.organization);
        setMembership(memberData as OrganizationMember);
      } else {
        // Los superadmins no necesitan organization ni membership propios
        setOrganization(null);
        setMembership(null);
      }

    } catch (error) {
      console.error('❌ Error fetching subscription data:', error);
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
    return isClientSubscription() || isERPSubscription();
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

  // Funciones para determinar el tipo de suscripción basadas en plan_id
  const isAPISubscription = () => {
    const org = organization || membership?.organization;
    const plan = org?.subscription_plan;
    return plan === 'api_base' || plan === 'api_pro';
  };

  const isClientSubscription = () => {
    const org = organization || membership?.organization;
    const plan = org?.subscription_plan;
    return plan === 'client_base' || plan === 'client_pro';
  };

  const isERPSubscription = () => {
    const org = organization || membership?.organization;
    return org?.subscription_plan === 'erp';
  };

  // Helper para verificar si tiene módulo específico (para usar con plan_configurations)
  const hasModule = (moduleName: string) => {
    if (isSuperAdmin) return true;
    
    const org = organization || membership?.organization;
    if (!org) return false;
    
    // Los módulos se verifican por el tipo de plan
    // API Base/Pro: tienen módulo "API"
    // Client Base/Pro: tienen módulos "API" + "Client"
    // ERP: tiene módulos "API" + "Client" + "Production"
    
    if (moduleName === 'API') {
      return isAPISubscription() || isClientSubscription() || isERPSubscription();
    }
    
    if (moduleName === 'Client') {
      return isClientSubscription() || isERPSubscription();
    }
    
    if (moduleName === 'Production') {
      return isERPSubscription();
    }
    
    return false;
  };

  // Funciones para acceso a funcionalidades específicas basadas en módulos
  const canAccessClientes = () => {
    // Admin, Gestor y Comercial pueden ver clientes (NO operador)
    const userRole = membership?.role;
    if (userRole === 'operador') {
      return false;
    }
    return hasModule('Client');
  };

  const canAccessPresupuestos = () => {
    // Admin, Gestor y Comercial pueden ver presupuestos (NO operador)
    // Nota: Comercial solo ve sus propios presupuestos (RLS lo controla)
    const userRole = membership?.role;
    if (userRole === 'operador') {
      return false;
    }
    return hasModule('Client');
  };

  const canAccessExcel = () => {
    // Requiere módulo API y ser admin de organización
    if (isSuperAdmin) return true;
    return hasModule('API') && isOrgAdmin;
  };

  const canAccessProductos = () => {
    // Requiere módulo API y ser admin de organización
    if (isSuperAdmin) return true;
    return hasModule('API') && isOrgAdmin;
  };

  const canAccessCategorias = () => {
    // Requiere módulo API y ser admin de organización
    if (isSuperAdmin) return true;
    return hasModule('API') && isOrgAdmin;
  };

  const canAccessProduccion = () => {
    // Admin, Gestor y Operador pueden ver pedidos (NO comercial)
    const userRole = membership?.role;
    if (userRole === 'comercial') {
      return false;
    }
    return hasModule('Production');
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
      case 'produccion':
        return canAccessProduccion();
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
        isERPSubscription,
        canAccessClientes,
        canAccessPresupuestos,
        canAccessExcel,
        canAccessProductos,
        canAccessCategorias,
        canAccessProduccion,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};