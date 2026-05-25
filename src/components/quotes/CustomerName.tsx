import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomerNameProps {
  customerId?: string | null;
  fallback?: string;
}

// Shared in-memory cache + in-flight dedupe across all CustomerName instances
const nameCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

async function fetchCustomerName(id: string): Promise<string> {
  if (nameCache.has(id)) return nameCache.get(id)!;
  if (inflight.has(id)) return inflight.get(id)!;
  const p = (async () => {
    const { data } = await supabase
      .from("customers")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    const name = data?.name || "";
    nameCache.set(id, name);
    inflight.delete(id);
    return name;
  })();
  inflight.set(id, p);
  return p;
}

export const CustomerName = ({ customerId, fallback = "—" }: CustomerNameProps) => {
  const [customerName, setCustomerName] = useState<string>(
    customerId && nameCache.has(customerId) ? nameCache.get(customerId)! || fallback : fallback
  );

  useEffect(() => {
    if (!customerId) {
      setCustomerName(fallback);
      return;
    }
    let cancelled = false;
    fetchCustomerName(customerId)
      .then((name) => {
        if (!cancelled) setCustomerName(name || fallback);
      })
      .catch(() => {
        if (!cancelled) setCustomerName(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, fallback]);

  return <span>{customerName}</span>;
};
