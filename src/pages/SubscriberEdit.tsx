import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface Suscriptor {
  id: string;
  name: string;
  subscription_plan: "api_base" | "api_pro" | "client_base" | "client_pro" | "custom";
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

      setSuscriptor(data);
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
      const { error } = await supabase
        .from('organizations')
        .update({
          name: suscriptor.name,
          subscription_plan: suscriptor.subscription_plan,
        })
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
                onValueChange={(value: "api_base" | "api_pro" | "client_base" | "client_pro" | "custom") => setSuscriptor({ ...suscriptor, subscription_plan: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_base">API Base</SelectItem>
                  <SelectItem value="api_pro">API Pro</SelectItem>
                  <SelectItem value="client_base">Cliente Base</SelectItem>
                  <SelectItem value="client_pro">Cliente Pro</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">¿Qué es el usuario API?</h4>
            <p className="text-sm text-muted-foreground">
              El usuario API es el administrador técnico principal de este suscriptor. 
              Tiene acceso completo a las funciones de API y puede gestionar la configuración técnica. 
              Los límites de excel y usuarios se configuran según el plan seleccionado.
            </p>
          </div>

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