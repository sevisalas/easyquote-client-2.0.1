import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, Building, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface LocalClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  integration_id: string;
  created_at: string;
  source: 'local';
}

interface HoldedClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  created_at: string;
  holded_id: string;
  code: string;
  vatnumber: string;
  source: 'holded';
}

type Cliente = LocalClient | HoldedClient;

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 10;

  // Verificar integración de Holded
  const { isHoldedActive } = useHoldedIntegration();
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  const fetchClientes = async () => {
    setLoading(true);
    try {
      let allClients: Cliente[] = [];

      // Obtener clientes locales
      const localClientsResponse = await supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Procesar clientes locales
      if (localClientsResponse.data) {
        const localClients: LocalClient[] = localClientsResponse.data.map(client => ({
          ...client,
          source: 'local' as const
        }));
        allClients = [...localClients];
      }

      // Solo obtener contactos de Holded si la integración está activa y tenemos organización
      if (isHoldedActive && currentOrganization?.id) {
        try {
          console.log('🔄 Fetching Holded contacts for organization:', currentOrganization.id);
          const { data, error } = await supabase.functions.invoke('holded-contacts', {
            body: { 
              organizationId: currentOrganization.id,
              searchTerm: searchTerm || undefined
            }
          });

          if (!error && data?.contacts) {
            console.log('✅ Holded contacts received:', data.contacts.length);
            const holdedClients: HoldedClient[] = data.contacts.map((contact: any) => ({
              id: `holded_${contact.id}`,
              name: contact.name || contact.customName || contact.code || 'Sin nombre',
              email: contact.email || '',
              phone: contact.phone || '',
              notes: '',
              created_at: new Date().toISOString(),
              holded_id: contact.id,
              code: contact.code || '',
              vatnumber: contact.vatNumber || '',
              source: 'holded' as const
            }));
            allClients = [...allClients, ...holdedClients];
          } else if (error) {
            console.error('❌ Error fetching Holded contacts:', error);
          }
        } catch (error) {
          console.error('❌ Error calling Holded edge function:', error);
        }
      } else if (isHoldedActive && !currentOrganization?.id) {
        console.warn('⚠️ Holded integration active but no organization ID');
      }

      // Aplicar filtro de búsqueda si existe
      if (searchTerm) {
        const filtered = allClients.filter(client => 
          client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (client.source === 'holded' && client.code.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        allClients = filtered;
      }

      // Paginación
      const totalItems = allClients.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedClients = allClients.slice(startIndex, endIndex);

      setClientes(paginatedClients);
      
      // Ajustar página actual si es necesario
      if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
      }
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Effect para cargar clientes cuando cambie la página o el término de búsqueda
  useEffect(() => {
    fetchClientes();
  }, [currentPage, isHoldedActive, currentOrganization?.id]);

  // Effect separado para búsqueda (resetear página)
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchClientes();
    }
  }, [searchTerm]);

  const deleteAllCustomers = async () => {
    const confirmed = window.confirm(
      '¿Estás seguro de que quieres eliminar TODOS los clientes locales? Esta acción no se puede deshacer.'
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase.functions.invoke('delete-all-customers');

      if (error) throw error;

      toast({
        title: "Clientes eliminados",
        description: "Todos los clientes locales han sido eliminados.",
      });

      fetchClientes();
    } catch (error) {
      console.error('Error deleting customers:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los clientes.",
        variant: "destructive",
      });
    }
  };

  const deleteAllHoldedClientes = async () => {
    const confirmed = window.confirm(
      '¿Estás seguro de que quieres eliminar TODOS los clientes importados de Holded? Esta acción no se puede deshacer.'
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase.functions.invoke('delete-holded-customers');

      if (error) throw error;

      toast({
        title: "Clientes eliminados",
        description: "Todos los clientes importados de Holded han sido eliminados.",
      });

      fetchClientes();
    } catch (error) {
      console.error('Error deleting Holded customers:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar los clientes de Holded.",
        variant: "destructive",
      });
    }
  };

  const deleteCliente = async (id: string, source: string) => {
    // Solo permitir eliminar clientes locales
    if (source === 'holded') {
      toast({
        title: "Acción no permitida",
        description: "No se pueden eliminar clientes de Holded desde aquí",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm('¿Estás seguro de que quieres eliminar este cliente?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado correctamente",
      });

      fetchClientes();
    } catch (error) {
      console.error('Error deleting cliente:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el cliente",
        variant: "destructive",
      });
    }
  };

  const getClientDisplayName = (cliente: Cliente): string => {
    if (cliente.source === 'local') {
      return cliente.name || 'Sin nombre';
    } else {
      return cliente.name || cliente.code || 'Sin nombre';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona tus clientes locales y visualiza los de Holded
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            onClick={deleteAllCustomers}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar Todos los Clientes
          </Button>
          {isHoldedActive && (
            <Button 
              variant="destructive" 
              onClick={deleteAllHoldedClientes}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar Clientes Holded
            </Button>
          )}
          <Button onClick={() => navigate('/clientes/nuevo')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar clientes..."
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
              <TableHead>Origen</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono/Código</TableHead>
              <TableHead>ID Integración</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  {searchTerm ? 'No se encontraron clientes que coincidan con la búsqueda.' : 'No hay clientes registrados.'}
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {cliente.source === 'local' ? (
                        <>
                          <User className="h-4 w-4 text-blue-500" />
                          <Badge variant="secondary">Local</Badge>
                        </>
                      ) : (
                        <>
                          <Building className="h-4 w-4 text-green-500" />
                          <Badge variant="outline">Holded</Badge>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {getClientDisplayName(cliente)}
                  </TableCell>
                  <TableCell>{cliente.email}</TableCell>
                  <TableCell>
                    {cliente.source === 'local' ? (
                      cliente.phone
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {cliente.code && `Código: ${cliente.code}`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cliente.source === 'local' ? (
                      <span className="text-sm">{cliente.integration_id || '—'}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {cliente.holded_id}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cliente.source === 'local' ? (
                      cliente.notes
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {cliente.vatnumber && `CIF: ${cliente.vatnumber}`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {cliente.source === 'local' ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCliente(cliente.id, cliente.source)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Solo lectura</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, clientes.length)} - {Math.min(currentPage * itemsPerPage, clientes.length)} de {clientes.length} clientes
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={clientes.length < itemsPerPage}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};