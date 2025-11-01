import { useState, useEffect } from "react";
import { Save, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";

interface PlanConfig {
  id: string;
  name: string;
  excel_limit: number;
  client_user_limit: number;
  available_modules: string[];
}

const GestionPlanes = () => {
  const { isSuperAdmin } = useSubscription();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [planes, setPlanes] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarPlanes();
  }, []);

  const cargarPlanes = async () => {
    try {
      const { data, error } = await supabase
        .from('plan_configurations')
        .select('*')
        .eq('is_active', true)
        .order('plan_id');

      if (error) throw error;

      if (data) {
        setPlanes(data.map((plan: any) => ({
          id: plan.plan_id,
          name: plan.name,
          excel_limit: plan.excel_limit,
          client_user_limit: plan.client_user_limit,
          available_modules: plan.available_modules || []
        })));
      }
    } catch (error: any) {
      console.error('Error cargando planes:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los planes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const actualizarPlan = (planId: string, field: 'excel_limit' | 'client_user_limit' | 'name' | 'available_modules', value: number | string | string[]) => {
    setPlanes(prev => prev.map(plan => 
      plan.id === planId ? { ...plan, [field]: value } : plan
    ));
  };

  const toggleModule = (planId: string, module: string) => {
    setPlanes(prev => prev.map(plan => {
      if (plan.id === planId) {
        const modules = plan.available_modules.includes(module)
          ? plan.available_modules.filter(m => m !== module)
          : [...plan.available_modules, module];
        return { ...plan, available_modules: modules };
      }
      return plan;
    }));
  };

  const guardarCambios = async () => {
    setSaving(true);
    try {
      // Actualizar cada plan en la base de datos
      for (const plan of planes) {
        const { error } = await supabase
          .from('plan_configurations')
          .update({
            name: plan.name,
            excel_limit: plan.excel_limit,
            client_user_limit: plan.client_user_limit,
            available_modules: plan.available_modules
          })
          .eq('plan_id', plan.id);

        if (error) throw error;
      }

      toast({
        title: "Configuración guardada",
        description: "Los límites de los planes han sido actualizados",
      });
    } catch (error: any) {
      console.error('Error al guardar:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acceso denegado</CardTitle>
            <CardDescription>
              No tienes permisos para acceder a la gestión de planes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuración de planes</h1>
          <p className="text-muted-foreground">
            Gestionar límites de excel y usuarios por plan
          </p>
        </div>
        <Button onClick={guardarCambios} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>

      {loading ? (
        <div className="text-center">Cargando planes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {planes.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {plan.name}
              </CardTitle>
              <CardDescription>
                Configurar límites para este plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={`name-${plan.id}`}>
                  Nombre del plan
                </Label>
                <Input
                  id={`name-${plan.id}`}
                  type="text"
                  value={plan.name}
                  onChange={(e) => actualizarPlan(plan.id, 'name', e.target.value)}
                />
              </div>
              
              <div>
                <Label>
                  Módulos disponibles
                </Label>
                <div className="space-y-2 mt-2">
                  {['API', 'Client', 'Production'].map((module) => (
                    <div key={module} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${plan.id}-${module}`}
                        checked={plan.available_modules.includes(module)}
                        onCheckedChange={() => toggleModule(plan.id, module)}
                      />
                      <Label 
                        htmlFor={`${plan.id}-${module}`}
                        className="text-sm font-normal"
                      >
                        {module}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              {plan.id === 'custom' ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Los límites del plan personalizado se configuran individualmente para cada suscriptor.
                  </p>
                  <div className="bg-muted/30 p-3 rounded-md">
                    <p className="text-sm font-medium">Límites configurables por suscriptor:</p>
                    <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                      <li>• Límite de excel: Variable según necesidades</li>
                      <li>• Máximo de usuarios: Variable según necesidades</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor={`excel-${plan.id}`}>
                      Límite de excel
                    </Label>
                    <Input
                      id={`excel-${plan.id}`}
                      type="number"
                      value={plan.excel_limit}
                      onChange={(e) => actualizarPlan(plan.id, 'excel_limit', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`users-${plan.id}`}>
                      Máximo de usuarios
                    </Label>
                    <Input
                      id={`users-${plan.id}`}
                      type="number"
                      value={plan.client_user_limit}
                      onChange={(e) => actualizarPlan(plan.id, 'client_user_limit', parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GestionPlanes;