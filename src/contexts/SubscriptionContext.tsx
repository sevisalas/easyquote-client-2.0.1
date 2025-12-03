import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SubscriptionPlan = 'api' | 'client' | 'erp' | 'custom' | 'api_base' | 'api_pro' | 'client_base' | 'client_pro';
type OrganizationRole = 'admin' | 'gestor' | 'comercial' | 'operador';

export interface Organization {
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
  allOrganizations: Organization[];
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  loading: boolean;
  refreshData: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
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
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAllUserOrganizations = async (userId: string): Promise<Organization[]> => {
    // Get organizations where user is a member
    const { data: memberOrgs } = await supabase
      .from('organization_members')
      .select(`
        organization_id,
        organization:organizations(id, name, subscription_plan, excel_limit, excel_extra, client_user_limit, client_user_extra, api_user_id, holded_external_customers, max_daily_orders)
      `)
      .eq('user_id', userId);

    // Get organizations where user is the API owner
    const { data: ownerOrgs } = await supabase
      .from('organizations')
      .select('*')
      .eq('api_user_id', userId);

    // Combine and deduplicate
    const orgsMap = new Map<string, Organization>();

    ownerOrgs?.forEach(org => {
      orgsMap.set(org.id, org as Organization);
    });

    memberOrgs?.forEach(member => {
      const org = member.organization as unknown as Organization;
      if (org && !orgsMap.has(org.id)) {
        orgsMap.set(org.id, org);
      }
    });

    return Array.from(orgsMap.values());
  };

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
        // Fetch all organizations the user belongs to
        const allOrgs = await fetchAllUserOrganizations(user.id);
        setAllOrganizations(allOrgs);
        console.log('🏢 All user organizations:', allOrgs);

        // Check if there's a selected organization in sessionStorage
        const savedOrgId = sessionStorage.getItem('selected_organization_id');
        let selectedOrg: Organization | null = null;

        if (savedOrgId) {
          selectedOrg = allOrgs.find(org => org.id === savedOrgId) || null;
          console.log('🔍 Looking for saved org:', savedOrgId, 'Found:', !!selectedOrg);
        }

        // If no saved selection, use the first organization
        // BUT don't override if user already has a saved selection (even if not found yet)
        if (!selectedOrg && allOrgs.length > 0 && !savedOrgId) {
          selectedOrg = allOrgs[0];
          sessionStorage.setItem('selected_organization_id', selectedOrg.id);
          console.log('📌 Auto-selected first org:', selectedOrg.name);
        }

        if (selectedOrg) {
          // Check if user is the owner or a member
          if (selectedOrg.api_user_id === user.id) {
            setOrganization(selectedOrg);
            setMembership(null);
          } else {
            // Get membership for this specific organization
            const { data: memberData } = await supabase
              .from('organization_members')
              .select(`*, organization:organizations(*)`)
              .eq('user_id', user.id)
              .eq('organization_id', selectedOrg.id)
              .maybeSingle();

            setOrganization(null);
            setMembership(memberData as OrganizationMember);
          }
        } else {
          setOrganization(null);
          setMembership(null);
        }
      } else {
        // Los superadmins no necesitan organization ni membership propios
        setOrganization(null);
        setMembership(null);
        setAllOrganizations([]);
      }

    } catch (error) {
      console.error('❌ Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = async (organizationId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const selectedOrg = allOrganizations.find(org => org.id === organizationId);
    if (!selectedOrg) return;

    sessionStorage.setItem('selected_organization_id', organizationId);

    // Clear EasyQuote token to force re-authentication with new org credentials
    sessionStorage.removeItem('easyquote_token');

    if (selectedOrg.api_user_id === user.id) {
      setOrganization(selectedOrg);
      setMembership(null);
    } else {
      const { data: memberData } = await supabase
        .from('organization_members')
        .select(`*, organization:organizations(*)`)
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      setOrganization(null);
      setMembership(memberData as OrganizationMember);
    }

    // Re-fetch EasyQuote token for the new organization
    try {
      const { data: credentials } = await supabase.rpc('get_organization_easyquote_credentials', {
        p_user_id: user.id
      });

      if (credentials && credentials.length > 0) {
        const userCredentials = credentials[0];
        if (userCredentials.api_username && userCredentials.api_password) {
          const { data } = await supabase.functions.invoke("easyquote-auth", {
            body: {
              email: userCredentials.api_username,
              password: userCredentials.api_password
            }
          });
          if ((data as any)?.token) {
            sessionStorage.setItem("easyquote_token", (data as any).token);
            window.dispatchEvent(new CustomEvent('easyquote-token-updated'));
          }
        }
      }
    } catch (e) {
      console.error("Error refreshing EasyQuote token:", e);
    }

    toast({
      title: "Organización cambiada",
      description: `Ahora estás trabajando con ${selectedOrg.name}`,
    });

    // Reload the page to reset all data
    window.location.reload();
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
        allOrganizations,
        isSuperAdmin,
        isOrgAdmin,
        loading,
        refreshData,
        switchOrganization,
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