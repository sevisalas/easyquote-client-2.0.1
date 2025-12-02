import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function WorkloadConfiguration() {
  const { organization } = useSubscription();
  const { toast } = useToast();
  const [maxDailyOrders, setMaxDailyOrders] = useState<number>(20);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setMaxDailyOrders(organization.max_daily_orders || 20);
    }
  }, [organization]);

  const handleSave = async () => {
    if (!organization) return;
    
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("organizations")
        .update({ max_daily_orders: maxDailyOrders })
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Capacidad actualizada",
        description: "La capacidad máxima diaria se ha guardado correctamente",
      });
    } catch (error) {
      console.error("Error updating capacity:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la capacidad",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuración de carga de trabajo</h1>
        <p className="text-muted-foreground mt-2">
          Define la capacidad máxima de pedidos que tu equipo puede gestionar por día
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capacidad máxima diaria</CardTitle>
          <CardDescription>
            Este valor se utiliza para calcular la carga de trabajo y alertar sobre sobrecarga de producción
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="max-capacity">Pedidos máximos por día</Label>
              <Input
                id="max-capacity"
                type="number"
                min="1"
                value={maxDailyOrders}
                onChange={(e) => setMaxDailyOrders(parseInt(e.target.value) || 1)}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Este valor representa cuántos pedidos puede procesar tu equipo en un día de trabajo normal
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="mb-0"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
