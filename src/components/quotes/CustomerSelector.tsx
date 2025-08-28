import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { toast } from "@/hooks/use-toast";

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
  placeholder = "Elige un cliente" 
}: CustomerSelectorProps) => {
  const { isHoldedActive, getHoldedContacts } = useHoldedIntegration();
  const [holdedCustomers, setHoldedCustomers] = useState<Customer[]>([]);
  const [loadingHolded, setLoadingHolded] = useState(false);

  // Cargar clientes locales solo si Holded no está activo
  const { data: localCustomers } = useQuery({ 
    queryKey: ["customers"], 
    queryFn: fetchLocalCustomers,
    enabled: !isHoldedActive
  });

  // Cargar clientes de Holded cuando esté activo
  useEffect(() => {
    if (!isHoldedActive) return;

    const loadHoldedCustomers = async () => {
      setLoadingHolded(true);
      try {
        const contacts = await getHoldedContacts();
        const formattedContacts = contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone
        }));
        setHoldedCustomers(formattedContacts);
      } catch (error) {
        console.error('Error loading Holded customers:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los clientes de Holded",
          variant: "destructive"
        });
        setHoldedCustomers([]);
      } finally {
        setLoadingHolded(false);
      }
    };

    loadHoldedCustomers();
  }, [isHoldedActive, getHoldedContacts]);

  const customers = isHoldedActive ? holdedCustomers : (localCustomers || []);
  const isLoading = isHoldedActive ? loadingHolded : false;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select onValueChange={onValueChange} value={value} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Cargando clientes..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {customers?.map((customer) => (
            <SelectItem key={customer.id} value={customer.id}>
              <div className="flex flex-col">
                <span>{customer.name}</span>
                {customer.email && (
                  <span className="text-xs text-muted-foreground">{customer.email}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isHoldedActive && (
        <p className="text-xs text-muted-foreground">
          Clientes sincronizados desde Holded
        </p>
      )}
    </div>
  );
};