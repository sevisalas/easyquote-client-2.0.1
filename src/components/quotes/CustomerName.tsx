import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomerNameProps {
  customerId?: string | null;
  holdedContactId?: string | null;
  fallback?: string;
}

export const CustomerName = ({ customerId, holdedContactId, fallback = "—" }: CustomerNameProps) => {
  const [customerName, setCustomerName] = useState<string>(fallback);

  useEffect(() => {
    if (!customerId && !holdedContactId) {
      setCustomerName(fallback);
      return;
    }

    const fetchCustomerName = async () => {
      try {
        // If customerId is provided, fetch from local customers
        if (customerId) {
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

        // If holdedContactId is provided, fetch from holded_contacts
        if (holdedContactId) {
          const { data: holdedContact } = await supabase
            .from('holded_contacts')
            .select('name')
            .eq('id', holdedContactId)
            .maybeSingle();

          if (holdedContact) {
            setCustomerName(holdedContact.name || fallback);
            return;
          }
        }

        setCustomerName(fallback);
      } catch (error) {
        console.error('Error fetching customer name:', error);
        setCustomerName(fallback);
      }
    };

    fetchCustomerName();
  }, [customerId, holdedContactId, fallback]);

  return <span>{customerName}</span>;
};