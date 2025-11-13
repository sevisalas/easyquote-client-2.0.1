import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface NuevoSuscriptor {
  organizationName: string;
  adminEmail: string;
  adminPassword: string;
  subscriptionPlan: "api_base" | "api_pro" | "client_base" | "client_pro" | "erp" | "custom";
  excelLimit?: number;
  excelExtra?: number;
  clientUserLimit?: number;
  clientUserExtra?: number;
}

const NuevoSuscriptor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useSubscription();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<NuevoSuscriptor>({
    organizationName: "",
    adminEmail: "",
    adminPassword: "",
    subscriptionPlan: "api_base",
    excelLimit: 0,
    excelExtra: 0,
    clientUserLimit: 0,
    clientUserExtra: 0,
  });

  const crearSuscriptor = async () => {
    // Validaciones
    if (!formData.organizationName.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la organización es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!formData.adminEmail.trim()) {
      toast({
        title: "Error",
        description: "El email del administrador es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!formData.adminPassword || formData.adminPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscriber', {
        body: {
          organizationName: formData.organizationName,
          adminEmail: formData.adminEmail,
          adminPassword: formData.adminPassword,
          subscriptionPlan: formData.subscriptionPlan,
          excelLimit: formData.subscriptionPlan === 'custom' ? formData.excelLimit : undefined,
          excelExtra: formData.subscriptionPlan === 'custom' ? formData.excelExtra : undefined,
          clientUserLimit: formData.subscriptionPlan === 'custom' ? formData.clientUserLimit : undefined,
          clientUserExtra: formData.subscriptionPlan === 'custom' ? formData.clientUserExtra : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Suscriptor creado correctamente",
      });

      navigate('/usuarios');
    } catch (error: any) {
      console.error('Error al crear suscriptor:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el suscriptor",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/usuarios')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo suscriptor</h1>
          <p className="text-muted-foreground">
            Crear una nueva organización y su usuario administrador
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del suscriptor</CardTitle>
          <CardDescription>
            Complete los datos de la nueva organización y su administrador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="organizationName">Nombre de la organización</Label>
              <Input
                id="organizationName"
                value={formData.organizationName}
                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                placeholder="Mi Empresa S.L."
              />
            </div>
            
            <div>
              <Label htmlFor="plan">Plan de suscripción</Label>
              <Select 
                value={formData.subscriptionPlan} 
                onValueChange={(value: "api_base" | "api_pro" | "client_base" | "client_pro" | "erp" | "custom") => 
                  setFormData({ ...formData, subscriptionPlan: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_base">API Base</SelectItem>
                  <SelectItem value="api_pro">API Pro</SelectItem>
                  <SelectItem value="client_base">Client Base</SelectItem>
                  <SelectItem value="client_pro">Client Pro</SelectItem>
                  <SelectItem value="erp">ERP</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Datos del administrador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adminEmail">Email del administrador</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder="admin@empresa.com"
                />
              </div>
              
              <div>
                <Label htmlFor="adminPassword">Contraseña</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
          </div>

          {/* Mostrar campos adicionales solo para plan personalizado */}
          {formData.subscriptionPlan === 'custom' && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Configuración personalizada</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="excel_limit">Límite base excel</Label>
                  <Input
                    id="excel_limit"
                    type="number"
                    value={formData.excelLimit || 0}
                    onChange={(e) => setFormData({ ...formData, excelLimit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="excel_extra">Excel adicionales</Label>
                  <Input
                    id="excel_extra"
                    type="number"
                    value={formData.excelExtra || 0}
                    onChange={(e) => setFormData({ ...formData, excelExtra: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="client_user_limit">Límite base usuarios</Label>
                  <Input
                    id="client_user_limit"
                    type="number"
                    value={formData.clientUserLimit || 0}
                    onChange={(e) => setFormData({ ...formData, clientUserLimit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="client_user_extra">Usuarios adicionales</Label>
                  <Input
                    id="client_user_extra"
                    type="number"
                    value={formData.clientUserExtra || 0}
                    onChange={(e) => setFormData({ ...formData, clientUserExtra: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={crearSuscriptor} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Creando...' : 'Crear suscriptor'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/usuarios')}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NuevoSuscriptor;
