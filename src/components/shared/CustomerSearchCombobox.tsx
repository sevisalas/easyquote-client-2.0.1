import React, { useState } from 'react';
import { Check, ChevronsUpDown, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { Badge } from '@/components/ui/badge';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  holded_id?: string;
  created_at: string;
}

interface CustomerSearchComboboxProps {
  value?: string;
  onSelect: (customer: Customer | null) => void;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
  onCreateNew?: () => void;
}

export const CustomerSearchCombobox: React.FC<CustomerSearchComboboxProps> = ({
  value,
  onSelect,
  placeholder = "Buscar cliente...",
  className,
  allowCreate = false,
  onCreateNew
}) => {
  const [open, setOpen] = useState(false);
  const { 
    searchTerm, 
    setSearchTerm, 
    searchResult, 
    loadMore, 
    selectCustomer,
    isHoldedIntegration 
  } = useCustomerSearch();

  const selectedCustomer = searchResult.customers.find(c => c.id === value);

  const handleSelect = (customer: Customer) => {
    const selected = selectCustomer(customer);
    onSelect(selected);
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchTerm('');
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between"
          >
            {selectedCustomer ? (
              <div className="flex items-center gap-2 truncate">
                <span className="truncate">{selectedCustomer.name}</span>
                {selectedCustomer.holded_id && (
                  <Badge variant="secondary" className="text-xs">
                    Holded
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Escriba para buscar cliente..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
            </div>
            <CommandList>
              {searchResult.loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Buscando...
                </div>
              ) : (
                <>
                  {searchResult.customers.length > 0 ? (
                    <CommandGroup>
                      {isHoldedIntegration && (
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b">
                          Clientes de Holded
                        </div>
                      )}
                      {searchResult.customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.id}
                          onSelect={() => handleSelect(customer)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {customer.name}
                              </span>
                              {customer.holded_id && (
                                <Badge variant="outline" className="text-xs">
                                  Holded
                                </Badge>
                              )}
                            </div>
                            {(customer.email || customer.phone) && (
                              <div className="text-xs text-muted-foreground truncate">
                                {customer.email && (
                                  <span>{customer.email}</span>
                                )}
                                {customer.email && customer.phone && (
                                  <span className="mx-1">•</span>
                                )}
                                {customer.phone && (
                                  <span>{customer.phone}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <Check
                            className={cn(
                              "ml-2 h-4 w-4 shrink-0",
                              value === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                      {searchResult.hasMore && (
                        <CommandItem
                          onSelect={loadMore}
                          className="justify-center text-primary cursor-pointer"
                        >
                          <ChevronsUpDown className="mr-2 h-4 w-4" />
                          Cargar más resultados
                        </CommandItem>
                      )}
                    </CommandGroup>
                  ) : searchTerm ? (
                    <CommandEmpty>
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          No se encontraron clientes para "{searchTerm}"
                        </p>
                        {allowCreate && onCreateNew && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              onCreateNew();
                              setOpen(false);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Crear cliente
                          </Button>
                        )}
                      </div>
                    </CommandEmpty>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {isHoldedIntegration 
                        ? "Escriba para buscar en sus 22,000+ clientes de Holded" 
                        : "Escriba para buscar clientes"
                      }
                    </div>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedCustomer && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect(null)}
          className="px-2"
        >
          ✕
        </Button>
      )}
    </div>
  );
};