import { createClient } from "@supabase/supabase-js";

// Cliente para el proyecto externo de Holded
const holdedSupabase = createClient(
  "https://sdvthvotbiqgjzsdnbju.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnRodm90YmlxZ2p6c2RuYmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNjcyNjIsImV4cCI6MjA3MTk0MzI2Mn0.ObR-zEgGs7GFxHsrp8z9jG98rtwgn6Kxd_TOTCU8ShU"
);

export interface HoldedContact {
  id: string;
  holded_id: string;
  name: string | null;
  email_original: string | null;
  code: string | null;
  vatnumber: string | null;
  source: 'holded';
}

export const fetchHoldedContacts = async (searchTerm?: string): Promise<HoldedContact[]> => {
  try {
    console.log('🔍 Fetching Holded contacts...', { searchTerm });
    
    let query = holdedSupabase
      .from("holded_contacts_index")
      .select("id, holded_id, name, email_original, code, vatnumber")
      .order("name", { ascending: true, nullsFirst: false });

    // Si hay un término de búsqueda, filtrar
    if (searchTerm && searchTerm.trim()) {
      query = query.or(`name.ilike.%${searchTerm}%,email_original.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`);
    }

    console.log('📡 Making request to Holded database...');
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching Holded contacts:', error);
      return [];
    }

    console.log('✅ Holded contacts fetched successfully:', data?.length, 'contacts');
    console.log('📋 Sample contacts:', data?.slice(0, 3));
    
    // Usar un índice único para evitar duplicados
    const uniqueContacts = new Map<string, HoldedContact>();
    
    (data || []).forEach((contact, index) => {
      const uniqueId = `holded_${contact.holded_id}`;
      if (!uniqueContacts.has(uniqueId)) {
        uniqueContacts.set(uniqueId, {
          ...contact,
          id: uniqueId,
          source: 'holded' as const
        });
      }
    });
    
    return Array.from(uniqueContacts.values());
  } catch (error) {
    console.error('❌ Error in fetchHoldedContacts:', error);
    return [];
  }
};

export const getHoldedContactById = async (holdedId: string): Promise<HoldedContact | null> => {
  try {
    const { data, error } = await holdedSupabase
      .from("holded_contacts_index")
      .select("id, holded_id, name, email_original, code, vatnumber")
      .eq("holded_id", holdedId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      id: `holded_${data.holded_id}`,
      source: 'holded'
    };
  } catch (error) {
    console.error('Error fetching Holded contact by ID:', error);
    return null;
  }
};