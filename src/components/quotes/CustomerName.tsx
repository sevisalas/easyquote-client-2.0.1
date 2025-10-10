import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomerNameProps {
  customerId: string | null | undefined;
  fallback?: string;
}

export const CustomerName = ({ customerId, fallback = "—" }: CustomerNameProps) => {
  const [customerName, setCustomerName] = useState<string>(fallback);

  useEffect(() => {
    if (!customerId) {
      setCustomerName(fallback);
      return;
    }

    const fetchCustomerName = async () => {
      try {
        // Try to fetch from local customers first
        const { data: localCustomer } = await supabase
          .from('customers')
          .select('name')
          .eq('id', customerId)
          .maybeSingle();

        if (localCustomer) {
          setCustomerName(localCustomer.name || fallback);
          return;
        }

        // If not found, try holded_contacts
        const { data: holdedContact } = await supabase
          .from('holded_contacts')
          .select('name')
          .eq('id', customerId)
          .maybeSingle();

        if (holdedContact) {
          setCustomerName(holdedContact.name || fallback);
        } else {
          setCustomerName(fallback);
        }
      } catch (error) {
        console.error('Error fetching customer name:', error);
        setCustomerName(fallback);
      }
    };

    fetchCustomerName();
  }, [customerId, fallback]);

  return <span>{customerName}</span>;
};