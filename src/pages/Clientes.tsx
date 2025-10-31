import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface LocalClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  integration_id: string;
  created_at: string;
}

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<LocalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalClients, setTotalClients] = useState(0);
  const itemsPerPage = 25;

  const fetchClientes = async () => {
    setLoading(true);
    try {
      // Construir la query base
      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Aplicar filtro de búsqueda si existe
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      console.log('🔍 Fetching customers with search term:', searchTerm);
      const { data, error, count } = await query;

      console.log('📊 Customers result:', { data, error, count, searchTerm });

      if (error) throw error;

      // Establecer total
      setTotalClients(count || 0);

      // Aplicar paginación
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedClients = (data || []).slice(startIndex, endIndex);

      console.log('📄 Paginated clients:', paginatedClients);
      setClientes(paginatedClients);
    } catch (error) {
      console.error("❌ Error al obtener clientes:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Effect para cargar clientes cuando cambie la página
  useEffect(() => {
    fetchClientes();
  }, [currentPage]);

  // Effect separado para búsqueda (resetear página)
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchClientes();
    }
  }, [searchTerm]);

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
            <TableRow>
              <TableHead className="py-2">Nombre</TableHead>
              <TableHead className="py-2">Email</TableHead>
              <TableHead className="py-2">Teléfono</TableHead>
              <TableHead className="py-2">Notas</TableHead>
              <TableHead className="py-2 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  {searchTerm
                    ? "No se encontraron clientes que coincidan con la búsqueda."
                    : "No hay clientes registrados."}
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="py-2 font-medium">{cliente.name || "Sin nombre"}</TableCell>
                  <TableCell className="py-2">{cliente.email}</TableCell>
                  <TableCell className="py-2">{cliente.phone}</TableCell>
                  <TableCell className="py-2">{cliente.notes}</TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCliente(cliente.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
