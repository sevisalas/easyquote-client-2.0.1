import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Check } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  subscription_plan: string;
}

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Iniciar sesión | App";

    // Reset to default EasyQuote colors on login page
    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-foreground');
    root.style.removeProperty('--secondary');
    root.style.removeProperty('--secondary-foreground');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-foreground');
    root.style.removeProperty('--muted');
    root.style.removeProperty('--muted-foreground');

    // If already logged in, redirect to dashboard
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (session) navigate("/", {
        replace: true
      });
    });
  }, [navigate]);
  const fetchUserOrganizations = async (userId: string): Promise<Organization[]> => {
    // Get organizations where user is a member
    const { data: memberOrgs } = await supabase
      .from('organization_members')
      .select(`
        organization_id,
        organization:organizations(id, name, subscription_plan)
      `)
      .eq('user_id', userId);

    // Get organizations where user is the API owner
    const { data: ownerOrgs } = await supabase
      .from('organizations')
      .select('id, name, subscription_plan')
      .eq('api_user_id', userId);

    // Combine and deduplicate
    const orgsMap = new Map<string, Organization>();

    ownerOrgs?.forEach(org => {
      orgsMap.set(org.id, org);
    });

    memberOrgs?.forEach(member => {
      const org = member.organization as unknown as Organization;
      if (org && !orgsMap.has(org.id)) {
        orgsMap.set(org.id, org);
      }
    });

    return Array.from(orgsMap.values());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        console.warn("No se pudo obtener el ID del usuario");
        setLoading(false);
        return;
      }

      const userId = session.session.user.id;

      // Check if user belongs to multiple organizations
      const userOrgs = await fetchUserOrganizations(userId);
      setOrganizations(userOrgs);
      console.log('🏢 User organizations found:', userOrgs.length, userOrgs.map(o => o.name));

      if (userOrgs.length > 1) {
        console.log('👥 Multiple orgs detected, showing selector...');
        // Clear any previous selection and set pending flag to prevent auto-selection
        sessionStorage.removeItem('selected_organization_id');
        sessionStorage.setItem('pending_org_selection', 'true');
        // Show organization selector
        setShowOrgSelector(true);
        setLoading(false);
        return;
      }

      console.log('📌 Single org or no org, proceeding directly...');
      // Single org or no org - proceed normally
      if (userOrgs.length === 1) {
        sessionStorage.setItem('selected_organization_id', userOrgs[0].id);
        console.log('📌 Auto-selected single org:', userOrgs[0].name);
      }

      await completeLogin(userId);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo iniciar sesión",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async (userId: string) => {
    // Obtener token de EasyQuote usando las credenciales guardadas
    try {
      const { data: credentials, error: credError } = await supabase.rpc('get_organization_easyquote_credentials', {
        p_user_id: userId
      });
      
      if (credError) {
        console.error("Error obteniendo credenciales:", credError);
      } else if (credentials && credentials.length > 0) {
        const userCredentials = credentials[0];
        if (userCredentials.api_username && userCredentials.api_password) {
          const { data, error: fxError } = await supabase.functions.invoke("easyquote-auth", {
            body: {
              email: userCredentials.api_username,
              password: userCredentials.api_password
            }
          });
          if (fxError) {
            console.error("easyquote-auth error", fxError);
          } else if ((data as any)?.token) {
            sessionStorage.setItem("easyquote_token", (data as any).token);
            console.log("Token de EasyQuote obtenido correctamente");
            window.dispatchEvent(new CustomEvent('easyquote-token-updated'));
          }
        } else {
          console.warn("Credenciales de EasyQuote incompletas");
        }
      } else {
        console.warn("No hay credenciales del API configuradas para este usuario");
      }
    } catch (e) {
      console.error("Error obteniendo el token de EasyQuote:", e);
    }

    toast({
      title: "Bienvenido",
      description: "Sesión iniciada correctamente"
    });
    
    // Force full page reload to ensure SubscriptionContext loads with the selected organization
    window.location.href = "/";
  };

  const handleOrgSelect = async (orgId: string) => {
    setSelectedOrgId(orgId);
    // Remove pending flag and set the selected organization
    sessionStorage.removeItem('pending_org_selection');
    sessionStorage.setItem('selected_organization_id', orgId);
    
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await completeLogin(user.id);
    }
    setLoading(false);
  };
  return <main className="min-h-screen bg-muted/30">
      <div className="container h-screen flex items-center justify-center p-0">
        <Card className="w-full max-w-5xl overflow-hidden border-0 shadow-2xl">
          <div className="grid md:grid-cols-2 h-full">
            {/* Left Side - Login Form or Org Selector */}
            <div className="flex flex-col justify-center p-8 md:p-12 bg-background">
              <div className="w-full max-w-sm mx-auto space-y-6">
                <div className="text-center space-y-4">
                  <img src="/lovable-uploads/logo_transparente-removebg-preview.png" alt="EasyQuote Logo" className="h-20 w-auto mx-auto" onError={e => {
                  const img = e.currentTarget;
                  if (img.dataset.fallbackApplied) {
                    img.style.display = 'none';
                    return;
                  }
                  img.src = '/lovable-uploads/logo_transparente.png';
                  img.dataset.fallbackApplied = 'true';
                }} />
                  <p className="text-sm text-muted-foreground">
                    {showOrgSelector ? "Selecciona una organización" : "Inicia sesión en tu cuenta"}
                  </p>
                </div>

                {showOrgSelector ? (
                  <div className="space-y-3">
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => handleOrgSelect(org.id)}
                        disabled={loading}
                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center gap-3 text-left ${
                          selectedOrgId === org.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{org.name}</p>
                          <p className="text-xs text-muted-foreground">{org.subscription_plan}</p>
                        </div>
                        {selectedOrgId === org.id && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    {loading && (
                      <p className="text-center text-sm text-muted-foreground">Cargando...</p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                      <Input id="email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                      <Input id="password" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="h-11" />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                      {loading ? "PROCESANDO..." : "LOGIN"}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* Right Side - Brand Panel */}
            <div className="hidden md:flex relative bg-background items-center justify-center overflow-hidden">
              <img src="/lovable-uploads/login-calculator.png" alt="" className="w-full h-full object-fill" />
            </div>
          </div>
        </Card>
      </div>
    </main>;
};
export default Auth;