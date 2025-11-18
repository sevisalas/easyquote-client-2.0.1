import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface LocalClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  integration_id: string;
  created_at: string;
  source: 'local' | 'holded';
}

export default function Clientes() {
  const navigate = useNavigate();
  const { organization, membership } = useSubscription();
  const [clientes, setClientes] = useState<LocalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalClients, setTotalClients] = useState(0);
  const itemsPerPage = 25;

  const fetchClientes = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setSearchLoading(true);
    }
    try {
      console.log('🔍 Fetching customers with search term:', searchTerm);

      // Get organization_id from either organization (owner) or membership (member)
      const organizationId = organization?.id || membership?.organization?.id;

      if (!organizationId) {
        console.log('⚠️ No organization found');
        setClientes([]);
        setTotalClients(0);
        setLoading(false);
        return;
      }

      const startIndex = (currentPage - 1) * itemsPerPage;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⚠️ No authenticated user');
        setClientes([]);
        setTotalClients(0);
        setLoading(false);
        return;
      }

      console.log('🔑 Fetching with auth context:', { 
        userId: user.id,
        organizationId,
        searchTerm,
        page: currentPage 
      });

      // Fetch all customers from unified table with pagination
      // Include both organization customers AND user's own customers
      let customersQuery = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .or(`organization_id.eq.${organizationId},user_id.eq.${user.id}`)
        .order("name", { ascending: true })
        .range(startIndex, startIndex + itemsPerPage - 1);

      if (searchTerm) {
        customersQuery = customersQuery.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data: customersData, error: customersError, count: customersCount } = await customersQuery;

      console.log('📊 Customers query result:', { 
        data: customersData,
        error: customersError,
        count: customersCount 
      });

      if (customersError) {
        console.error("❌ Error fetching customers:", customersError);
      }

      // Format all contacts
      const allClients: LocalClient[] = (customersData || []).map(c => ({
        id: c.id,
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
        notes: c.notes || '',
        integration_id: c.integration_id || '',
        created_at: c.created_at,
        source: c.source as 'local' | 'holded'
      }));
      console.log('✅ Total clients combined:', allClients.length);

      setTotalClients(customersCount || 0);
      setClientes(allClients);
    } catch (error) {
      console.error("❌ Error al obtener clientes:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  // Effect para cargar clientes cuando cambie la página u organización
  useEffect(() => {
    const organizationId = organization?.id || membership?.organization?.id;
    if (organizationId) {
      fetchClientes(true); // Initial load
    } else if (organization === null && membership === null) {
      // Organization is explicitly null (not loading)
      setLoading(false);
      setClientes([]);
      setTotalClients(0);
    }
  }, [currentPage, organization, membership]);

  // Effect separado para búsqueda con debounce (resetear página)
  useEffect(() => {
    const organizationId = organization?.id || membership?.organization?.id;
    if (!organizationId) {
      if (organization === null && membership === null) {
        setLoading(false);
        setClientes([]);
        setTotalClients(0);
      }
      return;
    }
    
    // Debounce search - wait 300ms after user stops typing
    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchClientes(false); // Not initial load
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm, organization, membership]);

  const deleteCliente = async (id: string) => {
    const confirmed = window.confirm("¿Estás seguro de que quieres eliminar este cliente?");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("customers").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado correctamente",
      });

      fetchClientes();
    } catch (error) {
      console.error("Error deleting cliente:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el cliente",
        variant: "destructive",
      });
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
          <p className="text-muted-foreground">Gestiona tus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/clientes/nuevo")} className="flex items-center gap-2">
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
            <TableRow className="h-9">
              <TableHead className="py-2 text-xs font-semibold">Nombre</TableHead>
              <TableHead className="py-2 text-xs font-semibold">Email</TableHead>
              <TableHead className="py-2 text-xs font-semibold">Teléfono</TableHead>
              <TableHead className="py-2 text-xs font-semibold">Origen</TableHead>
              <TableHead className="py-2 text-xs font-semibold">Notas</TableHead>
              <TableHead className="py-2 text-right text-xs font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6">
                  {searchTerm
                    ? "No se encontraron clientes que coincidan con la búsqueda."
                    : "No hay clientes registrados."}
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((cliente) => (
                <TableRow key={`${cliente.source}-${cliente.id}`} className="h-auto">
                  <TableCell className="py-1.5 px-3 text-sm font-medium">{cliente.name || "Sin nombre"}</TableCell>
                  <TableCell className="py-1.5 px-3 text-sm">{cliente.email}</TableCell>
                  <TableCell className="py-1.5 px-3 text-sm">{cliente.phone}</TableCell>
                  <TableCell className="py-1.5 px-3">
                    <Badge variant={cliente.source === 'local' ? 'default' : 'secondary'} className="text-xs px-2 py-0 h-5">
                      {cliente.source === 'local' ? 'Local' : 'Holded'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-sm">{cliente.notes}</TableCell>
                  <TableCell className="py-1.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {cliente.source === 'local' ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/clientes/${cliente.id}/editar`)} className="h-7 w-7 p-0">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteCliente(cliente.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Solo lectura</span>
                      )}
                    </div>
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
          Mostrando {clientes.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0} -{" "}
          {Math.min(currentPage * itemsPerPage, totalClients)} de {totalClients} clientes
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            title="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Números de página */}
          {(() => {
            const totalPages = Math.ceil(totalClients / itemsPerPage);
            const pageNumbers = [];
            const showPages = 5;
            
            let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
            let endPage = Math.min(totalPages, startPage + showPages - 1);
            
            if (endPage - startPage < showPages - 1) {
              startPage = Math.max(1, endPage - showPages + 1);
            }
            
            if (startPage > 1) {
              pageNumbers.push(
                <Button
                  key={1}
                  variant={currentPage === 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                >
                  1
                </Button>
              );
              if (startPage > 2) {
                pageNumbers.push(
                  <span key="dots1" className="px-2">...</span>
                );
              }
            }
            
            for (let i = startPage; i <= endPage; i++) {
              pageNumbers.push(
                <Button
                  key={i}
                  variant={currentPage === i ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(i)}
                >
                  {i}
                </Button>
              );
            }
            
            if (endPage < totalPages) {
              if (endPage < totalPages - 1) {
                pageNumbers.push(
                  <span key="dots2" className="px-2">...</span>
                );
              }
              pageNumbers.push(
                <Button
                  key={totalPages}
                  variant={currentPage === totalPages ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </Button>
              );
            }
            
            return pageNumbers;
          })()}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => prev + 1)}
            disabled={currentPage * itemsPerPage >= totalClients}
            title="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.ceil(totalClients / itemsPerPage))}
            disabled={currentPage * itemsPerPage >= totalClients}
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
