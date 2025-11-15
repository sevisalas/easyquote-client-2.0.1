import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Tipos
interface LocalCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source: 'local';
}

interface HoldedCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  holded_id: string;
  source: 'holded';
}

type Customer = LocalCustomer | HoldedCustomer;

interface CustomerSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

// Función para obtener clientes locales
const fetchLocalCustomers = async (): Promise<LocalCustomer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .order("created_at", { ascending: false })
    .limit(50000);
  
  if (error) {
    console.error('❌ Error fetching local customers:', error);
    throw error;
  }
  
  console.log('✅ Local customers fetched:', data?.length);
  
  return (data || []).map(customer => ({
    ...customer,
    source: 'local' as const
  }));
};

// Función para obtener contactos de Holded
const fetchHoldedCustomers = async (): Promise<HoldedCustomer[]> => {
  try {
    // Primero obtener el organization_id del usuario
    const { data: { user } } = await supabase.auth.getUser();
    console.log('🔍 Current user:', user?.id);
    
    if (!user) {
      console.log('⚠️ No user found, skipping Holded customers');
      return [];
    }

    // Intentar obtener la organización como owner
    let { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("api_user_id", user.id)
      .maybeSingle();

    // Si no es owner, buscar como miembro
    if (!org) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (membership) {
        org = { id: membership.organization_id };
      }
    }

    console.log('🔍 Organization found:', org?.id, 'Error:', orgError);

    if (!org) {
      console.log('⚠️ No organization found, skipping Holded customers');
      return [];
    }

    const { data, error } = await supabase
      .from("holded_contacts")
      .select("id, holded_id, name, email, phone")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50000);
    
    console.log('🔍 Holded contacts query result:', { count: data?.length, error });
    
    if (error) {
      console.error('❌ Error fetching Holded customers:', error);
      throw error;
    }
    
    console.log('✅ Holded customers fetched:', data?.length);
    
    return (data || []).map(customer => ({
      ...customer,
      source: 'holded' as const
    }));
  } catch (err) {
    console.error('❌ Exception in fetchHoldedCustomers:', err);
    return [];
  }
};

// Función principal para obtener todos los clientes
const fetchAllCustomers = async (): Promise<Customer[]> => {
  try {
    // Obtener clientes locales y de Holded
    const [localCustomers, holdedCustomers] = await Promise.all([
      fetchLocalCustomers(),
      fetchHoldedCustomers()
    ]);
    
    const allCustomers = [...localCustomers, ...holdedCustomers];
    
    return allCustomers.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    return [];
  }
};

export const CustomerSelector = ({ 
  value, 
  onValueChange, 
  label = "Cliente",
  placeholder = "Buscar cliente..." 
}: CustomerSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Función para obtener o crear cliente local desde Holded
  const getOrCreateLocalCustomer = async (holdedCustomer: HoldedCustomer): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ No hay usuario autenticado');
        return null;
      }

      console.log('🔍 Buscando cliente local para holded_id:', holdedCustomer.holded_id);
      
      // PRIMERO: Buscar si ya existe un cliente local con este holded_id
      const { data: existingCustomer, error: searchError } = await supabase
        .from("customers")
        .select("id, name, holded_id")
        .eq("holded_id", holdedCustomer.holded_id)
        .eq("user_id", user.id)
        .maybeSingle();

      console.log('🔍 Resultado búsqueda:', { existingCustomer, searchError });

      // Si ya existe, devolver su ID (NO crear duplicado)
      if (existingCustomer) {
        console.log('✅ Cliente local YA EXISTE, reutilizando ID:', existingCustomer.id);
        return existingCustomer.id;
      }

      // SOLO si NO existe, crear uno nuevo
      console.log('📝 NO existe, creando nuevo cliente local para holded_id:', holdedCustomer.holded_id);
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          holded_id: holdedCustomer.holded_id,
          name: holdedCustomer.name,
          email: holdedCustomer.email || null,
          phone: holdedCustomer.phone || null
        })
        .select("id, name, holded_id")
        .single();

      if (error) {
        console.error('❌ Error creando cliente local:', error);
        return null;
      }

      console.log('✅ Cliente local CREADO:', newCustomer);
      return newCustomer.id;
    } catch (err) {
      console.error('❌ Excepción en getOrCreateLocalCustomer:', err);
      return null;
    }
  };

  const handleCustomerSelect = async (customer: Customer) => {
    if (customer.source === 'holded') {
      const localCustomerId = await getOrCreateLocalCustomer(customer as HoldedCustomer);
      if (localCustomerId) {
        onValueChange(localCustomerId);
      }
    } else {
      onValueChange(customer.id);
    }
    setOpen(false);
  };

  // Cargar TODOS los clientes (locales + Holded)
  const { data: customers, isLoading, error } = useQuery({ 
    queryKey: ["all-customers"], 
    queryFn: async () => {
      const result = await fetchAllCustomers();
      console.log('✅ Clientes cargados:', result.length);
      return result;
    }
  });

  // Debug error si existe
  useEffect(() => {
    if (error) {
      console.error('❌ Query error:', error);
    }
  }, [error]);

  // Filtrar clientes basado en la búsqueda con useMemo para mejor performance
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    
    if (!searchValue) return customers;
    
    const search = searchValue.toLowerCase();
    return customers.filter(customer => {
      const name = customer.name?.toLowerCase() || "";
      const email = customer.email?.toLowerCase() || "";
      const phone = customer.phone?.toLowerCase() || "";
      
      return name.includes(search) || email.includes(search) || phone.includes(search);
    });
  }, [customers, searchValue]);

  // Limitar a 1000 resultados
  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice(0, 1000);
  }, [filteredCustomers]);

  // Log para debugging
  useEffect(() => {
    console.log(`🔍 Búsqueda "${searchValue}": ${filteredCustomers.length} resultados (mostrando ${paginatedCustomers.length})`);
  }, [searchValue, filteredCustomers.length, paginatedCustomers.length]);

  // Encontrar el cliente seleccionado
  const selectedCustomer = customers?.find(customer => customer.id === value);

  return (
    <div className="space-y-2">
      {label && <Label htmlFor="customer-selector">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="customer-selector"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between min-h-[40px] w-full"
          >
            {selectedCustomer ? (
              <div className="flex items-center gap-2 truncate">
                <User className={`h-4 w-4 flex-shrink-0 ${
                  selectedCustomer.source === 'holded' ? 'text-green-500' : 'text-blue-500'
                }`} />
                <div className="flex flex-col items-start truncate">
                  <div className="flex items-center gap-1">
                    <span className="font-medium truncate">{selectedCustomer.name || 'Sin nombre'}</span>
                    {selectedCustomer.source === 'holded' && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">Holded</span>
                    )}
                  </div>
                  {selectedCustomer.email && (
                    <span className="text-xs text-muted-foreground truncate">
                      {selectedCustomer.email}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <div className="flex flex-col">
            <div className="p-3 border-b">
              <Input 
                placeholder="Buscar cliente..." 
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="h-9"
              />
            </div>
            
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Cargando clientes...</div>
            ) : (
              <>
                {searchValue && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                    {filteredCustomers.length} resultado{filteredCustomers.length !== 1 ? 's' : ''} encontrado{filteredCustomers.length !== 1 ? 's' : ''}
                    {filteredCustomers.length > 1000 && ` (mostrando primeros 1000)`}
                  </div>
                )}
                
                <ScrollArea className="h-[400px]">
                  {paginatedCustomers.length === 0 && searchValue ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No se encontraron clientes.
                    </div>
                  ) : (
                    <div className="p-2">
                      {/* Clientes locales */}
                      {paginatedCustomers.filter(c => c.source === 'local').length > 0 && (
                        <div className="mb-4">
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Clientes Locales
                          </div>
                          {paginatedCustomers.filter(c => c.source === 'local').map((customer) => (
                            <button
                              key={customer.id}
                              onClick={() => handleCustomerSelect(customer)}
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <div className="flex flex-col flex-1 min-w-0 items-start">
                                <div className="flex items-center gap-2 w-full">
                                  <span className="font-medium truncate">{customer.name}</span>
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4 flex-shrink-0",
                                      value === customer.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </div>
                                {customer.email && (
                                  <span className="text-xs text-muted-foreground truncate w-full text-left">
                                    {customer.email}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Clientes de Holded */}
                      {paginatedCustomers.filter(c => c.source === 'holded').length > 0 && (
                        <div>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Contactos de Holded
                          </div>
                          {paginatedCustomers.filter(c => c.source === 'holded').map((customer) => (
                            <button
                              key={customer.id}
                              onClick={() => handleCustomerSelect(customer)}
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <User className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <div className="flex flex-col flex-1 min-w-0 items-start">
                                <div className="flex items-center gap-2 w-full">
                                  <span className="font-medium truncate">{customer.name}</span>
                                  <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded ml-1">
                                    Holded
                                  </span>
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4 flex-shrink-0",
                                      value === customer.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </div>
                                {customer.email && (
                                  <span className="text-xs text-muted-foreground truncate w-full text-left">
                                    {customer.email}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
