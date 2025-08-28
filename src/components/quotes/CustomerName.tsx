import { useEffect, useState } from "react";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { supabase } from "@/integrations/supabase/client";

interface CustomerNameProps {
  customerId: string | null | undefined;
  fallback?: string;
}

export const CustomerName = ({ customerId, fallback = "—" }: CustomerNameProps) => {
  const { isHoldedActive, getHoldedContacts } = useHoldedIntegration();
  const [customerName, setCustomerName] = useState<string>(fallback);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setCustomerName(fallback);
      return;
    }

    const fetchCustomerName = async () => {
      setLoading(true);
      try {
        // Buscar en clientes locales
        const { data, error } = await supabase
          .from("customers")
          .select("name")
          .eq("id", customerId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching customer:', error);
          setCustomerName(fallback);
        } else {
          setCustomerName(data?.name || fallback);
        }
      } catch (error) {
        console.error('Error fetching customer name:', error);
        setCustomerName(fallback);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerName();
  }, [customerId, isHoldedActive, getHoldedContacts, fallback]);

  if (loading) {
    return <span className="text-muted-foreground">Cargando...</span>;
  }

  return <span>{customerName}</span>;
};