import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown, Building, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchHoldedContacts, type HoldedContact } from "@/hooks/useHoldedContacts";

interface LocalCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source: 'local';
}

type Customer = LocalCustomer | HoldedContact;

interface CustomerSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

const fetchLocalCustomers = async (): Promise<LocalCustomer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(customer => ({
    ...customer,
    source: 'local' as const
  }));
};

const fetchAllCustomers = async (searchTerm?: string): Promise<Customer[]> => {
  try {
    console.log('🚀 Fetching all customers...');
    
    // Ejecutar ambas consultas en paralelo
    const [localCustomers, holdedContacts] = await Promise.all([
      fetchLocalCustomers(),
      fetchHoldedContacts(searchTerm)
    ]);

    console.log('📊 Results:', { 
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

  // Cargar todos los clientes (locales y de Holded)
  const { data: customers, isLoading } = useQuery({ 
    queryKey: ["all-customers", searchValue], 
    queryFn: () => fetchAllCustomers(searchValue.trim() ? searchValue : undefined),
    enabled: true
  });

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

  const selectedCustomer = customers?.find(customer => customer.id === value);

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.source === 'holded') {
      const holdedCustomer = customer as HoldedContact;
      // Priorizar nombre, luego código, luego holded_id
      if (holdedCustomer.name && holdedCustomer.name.trim()) {
        return holdedCustomer.name.trim();
      }
      if (holdedCustomer.code && holdedCustomer.code.trim()) {
        return `Cliente ${holdedCustomer.code.trim()}`;
      }
      return `Cliente ${holdedCustomer.holded_id}`;
    }
    return customer.name || "Cliente sin nombre";
  };

  const getCustomerEmail = (customer: Customer) => {
    if (customer.source === 'holded') {
      return (customer as HoldedContact).email_original;
    }
    return (customer as LocalCustomer).email;
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isLoading}
          >
            {selectedCustomer ? (
              <div className="flex items-center gap-2">
                {selectedCustomer.source === 'holded' ? (
                  <Building className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex flex-col items-start">
                  <span>{getCustomerDisplayName(selectedCustomer)}</span>
                  {getCustomerEmail(selectedCustomer) && (
                    <span className="text-xs text-muted-foreground">{getCustomerEmail(selectedCustomer)}</span>
                  )}
                </div>
              </div>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-background border border-border shadow-md z-50">
          <Command>
            <CommandInput 
              placeholder="Buscar cliente..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No se encontraron clientes.</CommandEmpty>
              
              {/* Clientes locales */}
              {filteredCustomers.some(c => c.source === 'local') && (
                <CommandGroup heading="Clientes locales">
                  {filteredCustomers
                    .filter(c => c.source === 'local')
                    .map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => {
                        onValueChange(customer.id);
                        setOpen(false);
                        setSearchValue("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{getCustomerDisplayName(customer)}</span>
                        {getCustomerEmail(customer) && (
                          <span className="text-xs text-muted-foreground">{getCustomerEmail(customer)}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Contactos de Holded */}
              {filteredCustomers.some(c => c.source === 'holded') && (
                <CommandGroup heading="Contactos Holded">
                  {filteredCustomers
                    .filter(c => c.source === 'holded')
                    .map((customer, index) => {
                      const holdedCustomer = customer as HoldedContact;
                      return (
                        <CommandItem
                          key={`holded-${holdedCustomer.holded_id}-${index}`}
                          value={customer.id}
                          onSelect={() => {
                            onValueChange(customer.id);
                            setOpen(false);
                            setSearchValue("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span>{getCustomerDisplayName(customer)}</span>
                            <div className="text-xs text-muted-foreground space-x-2">
                              {holdedCustomer.email_original && (
                                <span>{holdedCustomer.email_original}</span>
                              )}
                              {holdedCustomer.code && (
                                <span>• Código: {holdedCustomer.code}</span>
                              )}
                              {holdedCustomer.vatnumber && (
                                <span>• NIF: {holdedCustomer.vatnumber}</span>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};