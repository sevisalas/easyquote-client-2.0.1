import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface Cliente {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  created_at: string;
}

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();
  const { isHoldedActive } = useHoldedIntegration();
  const { organization, membership } = useSubscription();
  
  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCliente = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este cliente?")) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setClientes(clientes.filter(c => c.id !== id));
      toast({
        title: "Éxito",
        description: "Cliente eliminado correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el cliente",
        variant: "destructive",
      });
    }
  };

  const importFromHolded = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la organización",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('holded-import-customers', {
        body: { organizationId: currentOrganization.id }
      });

      if (error) {
        console.error('Error importing from Holded:', error);
        throw error;
      }

      toast({
        title: "Importación completada",
        description: data.message,
      });

      // Recargar la lista de clientes
      await fetchClientes();
    } catch (error) {
      console.error('Error importing customers from Holded:', error);
      toast({
        title: "Error",
        description: "No se pudieron importar los clientes desde Holded",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cliente.email && cliente.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <p className="text-muted-foreground">Cargando clientes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Clientes</h1>
              <p className="text-muted-foreground">Gestiona tu base de datos de clientes</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              {isHoldedActive && (
                <Button 
                  onClick={importFromHolded}
                  disabled={importing}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {importing ? "Importando..." : "Importar de Holded"}
                </Button>
              )}
              <Button 
                onClick={() => navigate('/clientes/nuevo')}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Cliente
              </Button>
            </div>
          </div>
        </header>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar clientes por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Fecha de creación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow key={cliente.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{cliente.name}</TableCell>
                  <TableCell>{cliente.email || 'No especificado'}</TableCell>
                  <TableCell>{cliente.phone || 'No especificado'}</TableCell>
                  <TableCell className="max-w-xs truncate">{cliente.notes || 'Sin notas'}</TableCell>
                  <TableCell>{new Date(cliente.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCliente(cliente.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredClientes.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              {searchTerm ? 'No se encontraron clientes' : 'Aún no tienes clientes registrados'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => navigate('/clientes/nuevo')}
                className="mt-4 bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear primer cliente
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Clientes;