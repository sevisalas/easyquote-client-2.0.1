import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, Building, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { fetchHoldedContacts, type HoldedContact } from "@/hooks/useHoldedContacts";

interface LocalClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  created_at: string;
  source: 'local';
}

interface HoldedClientAdapted extends HoldedContact {
  created_at: string;
  phone: string;
  notes: string;
  email: string; // Agregamos email para compatibilidad
}

type Cliente = LocalClient | HoldedClientAdapted;

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    fetchClientes();
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    fetchClientes();
  }, [searchTerm]);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      // Obtener clientes locales y de Holded en paralelo
      const [localClientsResponse, holdedContacts] = await Promise.all([
        supabase
          .from('customers')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false }),
        fetchHoldedContacts(searchTerm)
      ]);

      let allClients: Cliente[] = [];

      // Procesar clientes locales
      if (localClientsResponse.data) {
        const localClients: LocalClient[] = localClientsResponse.data.map(client => ({
          ...client,
          source: 'local' as const
        }));

        // Filtrar clientes locales por búsqueda si es necesario
        const filteredLocalClients = searchTerm 
          ? localClients.filter(client => 
              client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              client.email.toLowerCase().includes(searchTerm.toLowerCase())
            )
          : localClients;

        allClients.push(...filteredLocalClients);
      }

      // Procesar contactos de Holded (mapear a la interfaz Cliente)
      const holdedClients: HoldedClientAdapted[] = holdedContacts.map(contact => {
        console.log('🔍 PROCESSING HOLDED CONTACT:', {
          holded_id: contact.holded_id,
          name: contact.name,
          code: contact.code,
          email_original: contact.email_original,
          vatnumber: contact.vatnumber
        });
        
        return {
          ...contact,
          email: contact.email_original || '',
          phone: '', // Holded no tiene teléfono en este dataset
          notes: contact.vatnumber ? `NIF: ${contact.vatnumber}` : (contact.code || ''),
          created_at: new Date().toISOString(), // Fecha por defecto
        };
      });

      allClients.push(...holdedClients);

      // Aplicar paginación
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const paginatedClients = allClients.slice(startIndex, endIndex);

      setClientes(paginatedClients);
      setTotalCount(allClients.length);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCliente = async (id: string, source: 'local' | 'holded') => {
    // Solo permitir eliminar clientes locales
    if (source !== 'local') {
      toast({
        title: "No permitido",
        description: "Los contactos de Holded no se pueden eliminar desde aquí",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("¿Estás seguro de que quieres eliminar este cliente?")) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchClientes(); // Recargar la lista
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

  const getClientDisplayName = (cliente: Cliente) => {
    if (cliente.source === 'holded') {
      const holdedClient = cliente as HoldedClientAdapted;
      
      console.log('🔍 DEBUG HOLDED CLIENT:', {
        original_holded_id: holdedClient.holded_id,
        name_field: holdedClient.name,
        name_type: typeof holdedClient.name,
        name_length: holdedClient.name?.length,
        code_field: holdedClient.code,
        email_field: holdedClient.email_original,
        full_object: holdedClient
      });
      
      // PRIORIDAD CORRECTA: name -> code -> holded_id 
      if (holdedClient.name && holdedClient.name.trim() !== '' && holdedClient.name !== 'null') {
        console.log('✅ Using NAME:', holdedClient.name);
        return holdedClient.name;
      }
      
      if (holdedClient.code && holdedClient.code.trim() !== '' && holdedClient.code !== 'EMPTY') {
        console.log('✅ Using CODE:', holdedClient.code);
        return holdedClient.code;
      }
      
      console.log('❌ FALLBACK to holded_id:', holdedClient.holded_id);
      return holdedClient.holded_id;
    }
    return cliente.name;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (loading) {
    return (
    <div className="min-h-screen bg-background p-2">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <p className="text-muted-foreground">Cargando clientes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Clientes</h1>
              <p className="text-muted-foreground">Gestiona tu base de datos de clientes (locales y de Holded)</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
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
                <TableHead>Origen</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono/Código</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={`${cliente.source}-${cliente.id}`} className="hover:bg-muted/50 h-12">
                  <TableCell className="py-2">
                    <Badge variant={cliente.source === 'local' ? 'default' : 'secondary'} className="flex items-center w-fit">
                      {cliente.source === 'local' ? (
                        <>
                          <User className="w-3 h-3 mr-1" />
                          Local
                        </>
                      ) : (
                        <>
                          <Building className="w-3 h-3 mr-1" />
                          Holded
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium py-2">{getClientDisplayName(cliente)}</TableCell>
                  <TableCell className="py-2">{cliente.email || 'No especificado'}</TableCell>
                  <TableCell className="py-2">
                    {cliente.source === 'local' 
                      ? (cliente.phone || 'No especificado')
                      : (cliente as HoldedClientAdapted).code || 'Sin código'
                    }
                  </TableCell>
                  <TableCell className="max-w-xs truncate py-2">
                    {cliente.source === 'local' 
                      ? (cliente.notes || 'Sin notas')
                      : ((cliente as HoldedClientAdapted).vatnumber ? `NIF: ${(cliente as HoldedClientAdapted).vatnumber}` : 'Sin datos')
                    }
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <div className="flex justify-end gap-1">
                      {cliente.source === 'local' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCliente(cliente.id, cliente.source)}
                            className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      {cliente.source === 'holded' && (
                        <Badge variant="outline" className="text-xs">
                          Solo lectura
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        
        {/* Controles de paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount} clientes
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNumber)}
                      className="w-10"
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {clientes.length === 0 && !loading && (
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