import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export default function DeleteHoldedCustomers() {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar TODOS los clientes importados de Holded? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-holded-customers');

      if (error) throw error;

      toast({
        title: "Clientes eliminados",
        description: "Todos los clientes importados de Holded han sido eliminados exitosamente.",
      });
    } catch (error) {
      console.error('Error deleting Holded customers:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los clientes de Holded.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Eliminar Clientes de Holded</CardTitle>
          <CardDescription>
            Esta función eliminará todos los clientes que fueron importados desde Holded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Eliminando..." : "Eliminar Todos los Clientes de Holded"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
