import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ClientCard } from "@/components/clientes/ClientCard";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useTariffs } from "@/hooks/useTariffs";

interface LocalClient {
  id: string;
  name: string;
  trade_name: string;
  email: string;
  phone: string;
  notes: string;
  integration_id: string;
  created_at: string;
  source: 'local' | 'holded';
  tariff_id: string | null;
}

export default function Clientes() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { organization, membership } = useSubscription();
  const { isHoldedActive } = useHoldedIntegration();
  const selectedOrganizationId = typeof window !== "undefined" ? sessionStorage.getItem("selected_organization_id") : null;
  const organizationId = selectedOrganizationId || organization?.id || membership?.organization?.id || null;
  const isAdmin = membership?.role === "admin";
  const { tariffs } = useTariffs(isAdmin ? organizationId : null);

  const [clientes, setClientes] = useState<LocalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalClients, setTotalClients] = useState(0);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [assigningTariffCustomerId, setAssigningTariffCustomerId] = useState<string | null>(null);
  const itemsPerPage = 25;

  const fetchClientes = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setSearchLoading(true);
    }

    try {
      console.log("🔍 Fetching customers with search term:", searchTerm);

      if (!organizationId) {
        console.log("⚠️ No organization found");
        setClientes([]);
        setTotalClients(0);
        setLoading(false);
        return;
      }

      console.log("🏢 Using organization:", organizationId, "selected:", selectedOrganizationId);

      const startIndex = (currentPage - 1) * itemsPerPage;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("⚠️ No authenticated user");
        setClientes([]);
        setTotalClients(0);
        setLoading(false);
        return;
      }

      console.log("🔑 Fetching with auth context:", {
        userId: user.id,
        organizationId,
        searchTerm,
        page: currentPage,
      });

      let customersQuery = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .eq("organization_id", organizationId)
        .order("name", { ascending: true })
        .range(startIndex, startIndex + itemsPerPage - 1);

      if (searchTerm) {
        customersQuery = customersQuery.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data: customersData, error: customersError, count: customersCount } = await customersQuery;

      console.log("📊 Customers query result:", {
        data: customersData,
        error: customersError,
        count: customersCount,
      });

      if (customersError) {
        console.error("❌ Error fetching customers:", customersError);
      }

      const allClients: LocalClient[] = (customersData || []).map((c) => ({
        id: c.id,
        name: c.name || "",
        trade_name: (c as any).trade_name || "",
        email: c.email || "",
        phone: c.phone || "",
        notes: c.notes || "",
        integration_id: c.integration_id || "",
        created_at: c.created_at,
        source: c.source as 'local' | 'holded',
        tariff_id: (c as any).tariff_id || null,
      }));
      console.log("✅ Total clients combined:", allClients.length);

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

  useEffect(() => {
    if (organizationId) {
      fetchClientes(true);
    } else if (organization === null && membership === null) {
      setLoading(false);
      setClientes([]);
      setTotalClients(0);
    }
  }, [currentPage, organizationId]);

  useEffect(() => {
    if (!organizationId) {
      if (organization === null && membership === null) {
        setLoading(false);
        setClientes([]);
        setTotalClients(0);
      }
      return;
    }

    const timer = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchClientes(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, organizationId]);

  const handleImportContacts = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "No se encontró la organización",
        variant: "destructive",
      });
      return;
    }

    setIsImportingContacts(true);

    toast({
      title: "Importando contactos...",
      description: "Este proceso puede tardar aproximadamente 1 minuto.",
    });

    try {
      const { data, error } = await supabase.functions.invoke("holded-import-customers", {
        body: { organizationId },
      });

      if (error) throw error;

      toast({
        title: "Contactos actualizados",
        description: `Se importaron ${data?.imported || 0} nuevos clientes de ${data?.total || 0} totales`,
      });

      fetchClientes(true);
    } catch (error: any) {
      console.error("Error importing Holded contacts:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron importar los contactos",
        variant: "destructive",
      });
    } finally {
      setIsImportingContacts(false);
    }
  };

  const handleAssignTariff = async (customerId: string, tariffId: string | null) => {
    const previousClientes = clientes;
    setAssigningTariffCustomerId(customerId);
    setClientes((prev) => prev.map((cliente) => (cliente.id === customerId ? { ...cliente, tariff_id: tariffId } : cliente)));

    try {
      const { error } = await supabase
        .from("customers")
        .update({ tariff_id: tariffId })
        .eq("id", customerId);

      if (error) throw error;

      const selectedTariff = tariffs.find((tariff) => tariff.id === tariffId);
      toast({
        title: "Tarifa actualizada",
        description: selectedTariff ? `Asignada: ${selectedTariff.name}` : "Cliente sin tarifa",
      });
    } catch (error) {
      console.error("Error assigning tariff:", error);
      setClientes(previousClientes);
      toast({
        title: "Error",
        description: "No se pudo asignar la tarifa",
        variant: "destructive",
      });
    } finally {
      setAssigningTariffCustomerId(null);
    }
  };

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
    <div className={isMobile ? "p-0 md:p-2" : "container mx-auto p-6"}>
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isMobile ? "px-3 py-4" : "mb-6"}`}>
        <div>
          <h1 className={`font-bold tracking-tight ${isMobile ? "text-2xl" : "text-3xl"}`}>Clientes</h1>
          <p className="text-muted-foreground text-sm">Gestiona tus clientes</p>
        </div>
        <div className="flex gap-2">
          {isHoldedActive && (
            <Button
              onClick={handleImportContacts}
              disabled={isImportingContacts}
              variant="outline"
              size="sm"
              className="text-xs h-7"
            >
              <Download className="w-3 h-3 mr-1" />
              {isImportingContacts ? "Importando..." : "Actualizar contactos"}
            </Button>
          )}
          <Button
            onClick={() => navigate("/clientes/nuevo")}
            className={`flex items-center gap-2 ${isMobile ? "h-10" : ""}`}
          >
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      <div className={`flex items-center gap-4 ${isMobile ? "px-3 mb-4" : "mb-6"}`}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 ${isMobile ? "h-10" : ""}`}
          />
        </div>
        {searchLoading && <span className="text-xs text-muted-foreground">Actualizando…</span>}
      </div>

      {isMobile ? (
        <div className="px-3">
          {clientes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {searchTerm
                ? "No se encontraron clientes que coincidan con la búsqueda."
                : "No hay clientes registrados."}
            </div>
          ) : (
            clientes.map((cliente) => (
              <ClientCard
                key={`${cliente.source}-${cliente.id}`}
                cliente={cliente}
                onDelete={deleteCliente}
                isAdmin={isAdmin}
                tariffs={tariffs}
                onAssignTariff={handleAssignTariff}
                isAssigningTariff={assigningTariffCustomerId === cliente.id}
              />
            ))
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="py-2 text-xs font-semibold">Nombre</TableHead>
                <TableHead className="py-2 text-xs font-semibold">Email</TableHead>
                <TableHead className="py-2 text-xs font-semibold">Teléfono</TableHead>
                <TableHead className="py-2 text-xs font-semibold">Origen</TableHead>
                {isAdmin && <TableHead className="py-2 text-xs font-semibold">Tarifa</TableHead>}
                <TableHead className="py-2 text-right text-xs font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-6">
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
                      <Badge variant={cliente.source === "local" ? "default" : "secondary"} className="text-xs px-2 py-0 h-5">
                        {cliente.source === "local" ? "Local" : "Holded"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="py-1.5 px-3 min-w-[180px]">
                        <Select
                          value={cliente.tariff_id ?? "none"}
                          onValueChange={(value) => handleAssignTariff(cliente.id, value === "none" ? null : value)}
                          disabled={assigningTariffCustomerId === cliente.id || tariffs.length === 0}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder={tariffs.length > 0 ? "Sin tarifa" : "No hay tarifas"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin tarifa</SelectItem>
                            {tariffs.map((tariff) => (
                              <SelectItem key={tariff.id} value={tariff.id}>
                                {tariff.name} ({tariff.is_discount ? `-${tariff.percentage}%` : `+${tariff.percentage}%`}{!tariff.is_active ? " · inactiva" : ""})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell className="py-1.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {cliente.source === "local" ? (
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
      )}

      <div className={`flex ${isMobile ? "flex-col gap-3 px-3 mt-4" : "flex-row items-center justify-between mt-4"}`}>
        <div className={`text-sm text-muted-foreground ${isMobile ? "text-center" : ""}`}>
          Mostrando {clientes.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0} -{" "}
          {Math.min(currentPage * itemsPerPage, totalClients)} de {totalClients} clientes
        </div>
        <div className="flex items-center gap-1 justify-center">
          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="Primera página"
            className={isMobile ? "h-10" : ""}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            title="Anterior"
            className={isMobile ? "h-10" : ""}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

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
                  size={isMobile ? "default" : "sm"}
                  onClick={() => setCurrentPage(1)}
                  className={isMobile ? "h-10" : ""}
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
                  size={isMobile ? "default" : "sm"}
                  onClick={() => setCurrentPage(i)}
                  className={isMobile ? "h-10" : ""}
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
                  size={isMobile ? "default" : "sm"}
                  onClick={() => setCurrentPage(totalPages)}
                  className={isMobile ? "h-10" : ""}
                >
                  {totalPages}
                </Button>
              );
            }

            return pageNumbers;
          })()}

          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            disabled={currentPage * itemsPerPage >= totalClients}
            title="Siguiente"
            className={isMobile ? "h-10" : ""}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size={isMobile ? "default" : "sm"}
            onClick={() => setCurrentPage(Math.ceil(totalClients / itemsPerPage))}
            disabled={currentPage * itemsPerPage >= totalClients}
            title="Última página"
            className={isMobile ? "h-10" : ""}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
