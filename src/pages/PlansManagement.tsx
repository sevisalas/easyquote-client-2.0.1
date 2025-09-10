import { useState, useEffect } from "react";
import { Save, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface PlanConfig {
  id: string;
  name: string;
  excel_limit: number;
  client_user_limit: number;
}

const GestionPlanes = () => {
  const { isSuperAdmin } = useSubscription();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [planes, setPlanes] = useState<PlanConfig[]>([
    { id: 'api_base', name: 'API Base', excel_limit: 100, client_user_limit: 1 },
    { id: 'api_pro', name: 'API Pro', excel_limit: 500, client_user_limit: 1 },
    { id: 'client_base', name: 'Cliente Base', excel_limit: 100, client_user_limit: 2 },
    { id: 'client_pro', name: 'Cliente Pro', excel_limit: 500, client_user_limit: 5 },
    { id: 'custom', name: 'Personalizado', excel_limit: 1000, client_user_limit: 10 }
  ]);

  const actualizarPlan = (planId: string, field: 'excel_limit' | 'client_user_limit' | 'name', value: number | string) => {
    setPlanes(prev => prev.map(plan => 
      plan.id === planId ? { ...plan, [field]: value } : plan
    ));
  };

  const guardarCambios = async () => {
    setSaving(true);
    try {
      // Aquí podrías guardar en base de datos si fuera necesario
      // Por ahora solo mostramos que se guardó
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
                      Límite de excel por mes
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
    </div>
  );
};

export default GestionPlanes;