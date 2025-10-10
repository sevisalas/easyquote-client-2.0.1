import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
    .order("created_at", { ascending: false });
  
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

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("api_user_id", user.id)
      .single();

    console.log('🔍 Organization found:', org?.id, 'Error:', orgError);

    if (!org) {
      console.log('⚠️ No organization found, skipping Holded customers');
      return [];
    }

    const { data, error } = await supabase
      .from("holded_contacts")
      .select("id, holded_id, name, email, phone")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });
    
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

  // Cargar solo clientes locales
  const { data: customers, isLoading, error } = useQuery({ 
    queryKey: ["all-customers"], 
    queryFn: fetchAllCustomers
  });

  // Debug error si existe
  useEffect(() => {
    if (error) {
      console.error('❌ Query error:', error);
    }
  }, [error]);

  // Filtrar clientes basado en la búsqueda
  const filteredCustomers = customers?.filter(customer => {
    if (!searchValue) return true;
    const search = searchValue.toLowerCase();
    const name = customer.name?.toLowerCase() || "";
    const email = customer.email?.toLowerCase() || "";
    
    return name.includes(search) || email.includes(search);
  }) || [];

  // Encontrar el cliente seleccionado
  const selectedCustomer = customers?.find(customer => customer.id === value);

  return (
    <div className="flex flex-col space-y-2">
      {label && <Label htmlFor="customer-selector">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="customer-selector"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between min-h-[40px]"
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
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Buscar cliente..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Cargando clientes...</div>
              ) : (
                <>
                  <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                  
                  {/* Clientes locales */}
                  {filteredCustomers.filter(c => c.source === 'local').length > 0 && (
                    <CommandGroup heading="Clientes Locales">
                      {filteredCustomers.filter(c => c.source === 'local').map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.id}
                          onSelect={() => {
                            onValueChange(customer.id);
                            setOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{customer.name}</span>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    value === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </div>
                              {customer.email && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {customer.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* Clientes de Holded */}
                  {filteredCustomers.filter(c => c.source === 'holded').length > 0 && (
                    <CommandGroup heading="Contactos de Holded">
                      {filteredCustomers.filter(c => c.source === 'holded').map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.id}
                          onSelect={() => {
                            onValueChange(customer.id);
                            setOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <User className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{customer.name}</span>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    value === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </div>
                              {customer.email && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {customer.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
