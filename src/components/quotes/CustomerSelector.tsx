import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface CustomerSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

const fetchLocalCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Customer[];
};

export const CustomerSelector = ({ 
  value, 
  onValueChange, 
  label = "Cliente",
  placeholder = "Buscar cliente..." 
}: CustomerSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Cargar clientes locales
  const { data: customers, isLoading } = useQuery({ 
    queryKey: ["customers"], 
    queryFn: fetchLocalCustomers
  });

  // Filtrar clientes basado en la búsqueda
  const filteredCustomers = customers?.filter(customer =>
    customer.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (customer.email && customer.email.toLowerCase().includes(searchValue.toLowerCase()))
  ) || [];

  const selectedCustomer = customers?.find(customer => customer.id === value);

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
              <div className="flex flex-col items-start">
                <span>{selectedCustomer.name}</span>
                {selectedCustomer.email && (
                  <span className="text-xs text-muted-foreground">{selectedCustomer.email}</span>
                )}
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
              <CommandGroup>
                {filteredCustomers.map((customer) => (
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
                    <div className="flex flex-col">
                      <span>{customer.name}</span>
                      {customer.email && (
                        <span className="text-xs text-muted-foreground">{customer.email}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};