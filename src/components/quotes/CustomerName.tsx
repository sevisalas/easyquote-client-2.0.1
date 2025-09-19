import { useEffect, useState } from "react";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface CustomerNameProps {
  customerId: string | null | undefined;
  fallback?: string;
}

export const CustomerName = ({ customerId, fallback = "—" }: CustomerNameProps) => {
  const { isHoldedActive } = useHoldedIntegration();
  const { organization, membership } = useSubscription();
  const [customerName, setCustomerName] = useState<string>(fallback);
  const currentOrganization = organization || membership?.organization;

  useEffect(() => {
    if (!customerId) {
      setCustomerName(fallback);
      return;
    }

    const fetchCustomerName = async () => {
      try {
        // Primero intentar buscar en clientes locales
        if (!customerId.startsWith('holded_')) {
          const { data: localCustomer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', customerId)
            .maybeSingle();

          if (localCustomer) {
            setCustomerName(localCustomer.name || fallback);
            return;
          }
        }

        // Si es de Holded y la integración está activa
        if (customerId.startsWith('holded_') && isHoldedActive && currentOrganization?.id) {
          try {
            const { data, error } = await supabase.functions.invoke('holded-contacts', {
              body: { organizationId: currentOrganization.id }
            });

            if (!error && data?.contacts) {
              const holdedId = customerId.replace('holded_', '');
              const contact = data.contacts.find((c: any) => c.id === holdedId);
              if (contact) {
                setCustomerName(contact.name || contact.customName || contact.code || fallback);
                return;
              }
            }
          } catch (error) {
            console.error('Error fetching Holded contact:', error);
          }
        }

        setCustomerName(fallback);
      } catch (error) {
        console.error('Error fetching customer name:', error);
        setCustomerName(fallback);
      }
    };

    fetchCustomerName();
  }, [customerId, fallback, isHoldedActive, currentOrganization?.id]);

  return <span>{customerName}</span>;
};