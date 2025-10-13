import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Settings, Plus, Trash2, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Organization {
  id: string;
  name: string;
}

interface Integration {
  id: string;
  name: string;
  integration_type: string | null;
  description: string | null;
}

interface IntegrationAccess {
  id: string;
  organization_id: string;
  integration_id: string;
  granted_by: string;
  created_at: string;
  generate_pdfs: boolean;
  organization?: Organization;
  integration?: Integration;
}

const AVAILABLE_INTEGRATIONS = [
  { value: "057530ab-4982-40c1-bc92-b2a4ff7af8a8", label: "Holded" },
  { value: "fbf56a7f-8508-45a7-bb5e-e9f616dc1ecb", label: "WooCommerce" },
];

const IntegrationAccess = () => {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [integrationAccesses, setIntegrationAccesses] = useState<IntegrationAccess[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState("");
  const [granting, setGranting] = useState(false);

  const { toast } = useToast();
  const { isSuperAdmin } = useSubscription();

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadData();
  }, [isSuperAdmin]);

  const loadData = async () => {
    try {
      // Load organizations
      const { data: orgsData, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

      // Load integration accesses with integration details
      const { data: accessData, error: accessError } = await supabase
        .from("organization_integration_access")
        .select("*, integrations(id, name, integration_type, description)")
        .order("created_at", { ascending: false });

      if (accessError) throw accessError;

      // Manually map organization and integration data
      const accessesWithOrgs = (accessData || []).map((access: any) => ({
        ...access,
        granted_by: access.user_id || null,
        organization: orgsData?.find((org) => org.id === access.organization_id),
        integration: access.integrations,
      }));

      setIntegrationAccesses(accessesWithOrgs as any);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const grantAccess = async () => {
    if (!selectedOrg || !selectedIntegration) return;

    setGranting(true);
    try {
      // Check if access already exists
      const { data: existingAccess } = await supabase
        .from("organization_integration_access")
        .select("id")
        .eq("organization_id", selectedOrg)
        .eq("integration_id", selectedIntegration)
        .maybeSingle();

      if (existingAccess) {
        toast({
          title: "Acceso ya existe",
          description: "Esta organización ya tiene acceso a esta integración",
          variant: "destructive",
        });
        setGranting(false);
        return;
      }

      const { error } = await supabase.from("organization_integration_access").insert({
        organization_id: selectedOrg,
        integration_id: selectedIntegration,
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Acceso a integración concedido correctamente",
      });

      setSelectedOrg("");
      setSelectedIntegration("");
      loadData();
    } catch (error) {
      console.error("Error granting access:", error);
      toast({
        title: "Error",
        description: "No se pudo conceder el acceso",
        variant: "destructive",
      });
    } finally {
      setGranting(false);
    }
  };

  const revokeAccess = async (accessId: string) => {
    try {
      const { error } = await supabase.from("organization_integration_access").delete().eq("id", accessId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Acceso revocado correctamente",
      });

      loadData();
    } catch (error) {
      console.error("Error revoking access:", error);
      toast({
        title: "Error",
        description: "No se pudo revocar el acceso",
        variant: "destructive",
      });
    }
  };

  const toggleGeneratePdfs = async (accessId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("organization_integration_access")
        .update({ generate_pdfs: !currentValue })
        .eq("id", accessId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Configuración actualizada: ${!currentValue ? "Se generarán PDFs" : "Se usará el CRM/ERP integrado"}`,
      });

      loadData();
    } catch (error) {
      console.error("Error updating generate_pdfs:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración",
        variant: "destructive",
      });
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Acceso denegado</h1>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Gestión de acceso a integraciones</h1>
          <p className="text-muted-foreground">Administra qué organizaciones tienen acceso a cada integración</p>
        </div>
      </div>

      {/* Grant Access Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Conceder acceso
          </CardTitle>
          <CardDescription>Otorga acceso a una integración específica para una organización</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Organización</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar organización" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Integración</label>
              <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar integración" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_INTEGRATIONS.map((integration) => (
                    <SelectItem key={integration.value} value={integration.value}>
                      {integration.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={grantAccess} disabled={!selectedOrg || !selectedIntegration || granting}>
              {granting ? "Concediendo..." : "Conceder Acceso"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Accesses */}
      <Card>
        <CardHeader>
          <CardTitle>Accesos actuales</CardTitle>
          <CardDescription>Lista de todos los accesos a integraciones concedidos</CardDescription>
        </CardHeader>
        <CardContent>
          {integrationAccesses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay accesos concedidos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {integrationAccesses.map((access) => (
                <div key={access.id} className="flex items-center justify-between p-4 border rounded-lg gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="font-medium">{access.organization?.name || "Organización desconocida"}</div>
                    <div className="text-sm text-muted-foreground">
                      Integración:{" "}
                      {access.integration?.name || AVAILABLE_INTEGRATIONS.find((i) => i.value === access.integration_id)?.label || "Desconocida"}
                      {access.integration?.integration_type && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                          {access.integration.integration_type}
                        </span>
                      )}
                    </div>
                    {access.integration?.description && (
                      <div className="text-xs text-muted-foreground italic">
                        {access.integration.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Concedido: {new Date(access.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-start gap-2 border-l pl-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor={`generate-pdf-${access.id}`} className="text-sm font-medium cursor-pointer">
                          Generación de PDFs
                        </Label>
                        <Switch
                          id={`generate-pdf-${access.id}`}
                          checked={access.generate_pdfs}
                          onCheckedChange={() => toggleGeneratePdfs(access.id, access.generate_pdfs)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        {access.generate_pdfs
                          ? "Los PDFs se generan localmente en la aplicación"
                          : "Los presupuestos se exportan al CRM/ERP integrado (sin generar PDF local)"}
                      </p>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción revocará el acceso de la organización a esta integración. No se podrá deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revokeAccess(access.id)}>Revocar Acceso</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationAccess;
