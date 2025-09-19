import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, Building, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { useSubscription } from "@/contexts/SubscriptionContext";

// Tipos
interface LocalCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source: 'local';
}

interface HoldedContact {
  id: string;
  holded_id: string;
  name: string | null;
  email_original: string | null;
  code: string | null;
  vatnumber: string | null;
  source: 'holded';
}

type Customer = LocalCustomer | HoldedContact;

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

// Función principal para obtener todos los clientes
const fetchAllCustomers = async (searchTerm?: string, includeHolded = false, organizationId?: string): Promise<Customer[]> => {
  try {
    console.log('🚀 Fetching all customers - includeHolded:', includeHolded, 'orgId:', organizationId);
    
    // Obtener clientes locales siempre
    const localCustomers = await fetchLocalCustomers();
    
    // Solo obtener contactos de Holded si la integración está activa y tenemos organizationId
    let holdedContacts: HoldedContact[] = [];
    if (includeHolded && organizationId) {
      try {
        console.log('📡 Calling holded-contacts edge function for organization:', organizationId);
        const { data, error } = await supabase.functions.invoke('holded-contacts', {
          body: { organizationId, searchTerm }
        });
        
        if (error) {
          console.error('❌ Error from Holded edge function:', error);
        } else {
          console.log('✅ Holded contacts received:', data?.contacts?.length || 0);
          holdedContacts = (data?.contacts || []).map((contact: any) => ({
            id: `holded_${contact.id}`,
            holded_id: contact.id,
            name: contact.name || contact.customName || 'Sin nombre',
            email_original: contact.email,
            code: contact.code,
            vatnumber: contact.vatNumber,
            source: 'holded' as const
          }));
        }
      } catch (error) {
        console.error('❌ Error calling Holded edge function:', error);
      }
    } else if (includeHolded && !organizationId) {
      console.warn('⚠️ Holded integration active but no organization ID available');
    }

    console.log('📊 Results summary:', { 
      localCustomers: localCustomers.length, 
      holdedContacts: holdedContacts.length 
    });

    // Combinar y ordenar por nombre
    const allCustomers = [...localCustomers, ...holdedContacts];
    
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

  // Verificar si la integración de Holded está activa
  const { isHoldedActive, loading: holdedLoading } = useHoldedIntegration();
  
  // Obtener información de la organización
  const { organization, membership } = useSubscription();
  const currentOrganization = organization || membership?.organization;

  // Cargar todos los clientes (locales y opcionalmente de Holded)
  const { data: customers, isLoading, error } = useQuery({ 
    queryKey: ["all-customers", searchValue, isHoldedActive, currentOrganization?.id], 
    queryFn: () => fetchAllCustomers(
      searchValue.trim() ? searchValue : undefined, 
      isHoldedActive,
      currentOrganization?.id
    ),
    enabled: !holdedLoading // Solo ejecutar cuando ya sepamos si Holded está activo
  });

  // Debug error si existe
  useEffect(() => {
    if (error) {
      console.error('❌ Query error:', error);
    }
  }, [error]);

  // Filtrar clientes basado en la búsqueda (filtro adicional del lado cliente)
  const filteredCustomers = customers?.filter(customer => {
    if (!searchValue) return true;
    const search = searchValue.toLowerCase();
    const name = customer.name?.toLowerCase() || "";
    const email = customer.source === 'local' 
      ? (customer as LocalCustomer).email?.toLowerCase() || ""
      : (customer as HoldedContact).email_original?.toLowerCase() || "";
    const code = customer.source === 'holded' 
      ? (customer as HoldedContact).code?.toLowerCase() || ""
      : "";
    
    return name.includes(search) || email.includes(search) || code.includes(search);
  }) || [];

  // Separar clientes por origen
  const localCustomers = filteredCustomers.filter(c => c.source === 'local') as LocalCustomer[];
  const holdedCustomers = filteredCustomers.filter(c => c.source === 'holded') as HoldedContact[];

  // Encontrar el cliente seleccionado
  const selectedCustomer = customers?.find(customer => customer.id === value);

  // Función para obtener el nombre de visualización de un cliente
  const getCustomerDisplayName = (customer: Customer): string => {
    if (customer.source === 'local') {
      return customer.name || 'Sin nombre';
    } else {
      // Para Holded, priorizar nombre > código > ID
      return customer.name || customer.code || customer.holded_id || 'Sin nombre';
    }
  };

  // Función para obtener el email de un cliente
  const getCustomerEmail = (customer: Customer): string => {
    if (customer.source === 'local') {
      return customer.email || '';
    } else {
      return customer.email_original || '';
    }
  };

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
                {selectedCustomer.source === 'local' ? (
                  <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Building className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                <div className="flex flex-col items-start truncate">
                  <span className="font-medium truncate">{getCustomerDisplayName(selectedCustomer)}</span>
                  {getCustomerEmail(selectedCustomer) && (
                    <span className="text-xs text-muted-foreground truncate">
                      {getCustomerEmail(selectedCustomer)}
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
          <Command>
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
                  {localCustomers.length > 0 && (
                    <CommandGroup heading="Clientes Locales">
                      {localCustomers.map((customer) => (
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
                  {holdedCustomers.length > 0 && (
                    <CommandGroup heading="Clientes Holded">
                      {holdedCustomers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.id}
                          onSelect={() => {
                            onValueChange(customer.id);
                            setOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Building className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {getCustomerDisplayName(customer)}
                                </span>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    value === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </div>
                              <div className="flex flex-col">
                                {customer.email_original && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {customer.email_original}
                                  </span>
                                )}
                                {customer.code && (
                                  <span className="text-xs text-muted-foreground">
                                    Código: {customer.code}
                                  </span>
                                )}
                              </div>
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