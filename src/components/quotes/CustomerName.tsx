import { useEffect, useState } from "react";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { supabase } from "@/integrations/supabase/client";
import { getHoldedContactById } from "@/hooks/useHoldedContacts";

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
        // Verificar si es un contacto de Holded (prefijo "holded_")
        if (customerId.startsWith("holded_")) {
          const holdedId = customerId.replace("holded_", "");
          const holdedContact = await getHoldedContactById(holdedId);
          
          if (holdedContact?.name) {
            setCustomerName(holdedContact.name);
          } else {
            setCustomerName(`Contacto ${holdedContact?.code || holdedId}`);
          }
        } else {
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