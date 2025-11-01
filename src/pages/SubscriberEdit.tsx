import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface Suscriptor {
  id: string;
  name: string;
  subscription_plan: "api_base" | "api_pro" | "client_base" | "client_pro" | "erp" | "custom";
  excel_limit?: number;
  excel_extra?: number;
  client_user_limit?: number;
  client_user_extra?: number;
  holded_external_customers?: boolean;
}

const EditarSuscriptor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suscriptor, setSuscriptor] = useState<Suscriptor | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/');
      return;
    }
    obtenerSuscriptor();
  }, [id, isSuperAdmin, navigate]);

  const obtenerSuscriptor = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Error",
          description: "Suscriptor no encontrado",
          variant: "destructive",
        });
        navigate('/usuarios');
        return;
      }

      setSuscriptor(data as any);
    } catch (error: any) {
      console.error('Error al obtener suscriptor:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo obtener el suscriptor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const guardarCambios = async () => {
    if (!suscriptor) return;

    setSaving(true);
    try {
      const updateData: any = {
        name: suscriptor.name,
        subscription_plan: suscriptor.subscription_plan,
        holded_external_customers: suscriptor.holded_external_customers || false,
      };
      
      // Solo actualizar límites si es plan personalizado
      if (suscriptor.subscription_plan === 'custom') {
        updateData.excel_limit = suscriptor.excel_limit;
        updateData.excel_extra = suscriptor.excel_extra;
        updateData.client_user_limit = suscriptor.client_user_limit;
        updateData.client_user_extra = suscriptor.client_user_extra;
      }

      const { error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', suscriptor.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Suscriptor actualizado correctamente",
      });

      navigate('/usuarios');
    } catch (error: any) {
      console.error('Error al guardar:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!suscriptor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Suscriptor no encontrado</p>
      </div>
    );
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
          <h1 className="text-3xl font-bold">Editar suscriptor</h1>
          <p className="text-muted-foreground">
            Modificar la configuración del suscriptor
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del suscriptor</CardTitle>
          <CardDescription>
            Modificar nombre y plan del suscriptor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre del suscriptor</Label>
              <Input
                id="name"
                value={suscriptor.name}
                onChange={(e) => setSuscriptor({ ...suscriptor, name: e.target.value })}
                placeholder="Mi Empresa S.L."
              />
            </div>
            
            <div>
              <Label htmlFor="plan">Plan de suscripción</Label>
              <Select 
                value={suscriptor.subscription_plan} 
                onValueChange={(value: "api_base" | "api_pro" | "client_base" | "client_pro" | "erp" | "custom") => setSuscriptor({ ...suscriptor, subscription_plan: value })}
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

          {/* Holded External Customers */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="holded_external"
              checked={suscriptor.holded_external_customers || false}
              onCheckedChange={(checked) => setSuscriptor({ ...suscriptor, holded_external_customers: checked as boolean })}
            />
            <Label 
              htmlFor="holded_external"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Holded Externo
            </Label>
          </div>

          {/* Mostrar campos adicionales solo para plan personalizado */}
          {suscriptor.subscription_plan === 'custom' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="excel_limit">Límite base excel</Label>
                  <Input
                    id="excel_limit"
                    type="number"
                    value={suscriptor.excel_limit || 0}
                    onChange={(e) => setSuscriptor({ ...suscriptor, excel_limit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="excel_extra">Excel adicionales</Label>
                  <Input
                    id="excel_extra"
                    type="number"
                    value={suscriptor.excel_extra || 0}
                    onChange={(e) => setSuscriptor({ ...suscriptor, excel_extra: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client_user_limit">Límite base usuarios</Label>
                  <Input
                    id="client_user_limit"
                    type="number"
                    value={suscriptor.client_user_limit || 0}
                    onChange={(e) => setSuscriptor({ ...suscriptor, client_user_limit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="client_user_extra">Usuarios adicionales</Label>
                  <Input
                    id="client_user_extra"
                    type="number"
                    value={suscriptor.client_user_extra || 0}
                    onChange={(e) => setSuscriptor({ ...suscriptor, client_user_extra: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button onClick={guardarCambios} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
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

export default EditarSuscriptor;