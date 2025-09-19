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
    console.log('🚀 FETCHANDO CONTACTOS DE HOLDED - SEARCH:', searchTerm);
    
    // Seleccionar TODOS los campos para debuggear
    let query = holdedSupabase
      .from("holded_contacts_index")
      .select("*")
      .order("name", { ascending: true, nullsFirst: false });

    // Si hay un término de búsqueda, filtrar
    if (searchTerm && searchTerm.trim()) {
      query = query.or(`name.ilike.%${searchTerm}%,email_original.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`);
    }

    console.log('📡 EJECUTANDO CONSULTA A HOLDED...');
    const { data, error } = await query.limit(15); // Limitar a 15 para debuggear
    
    if (error) {
      console.error('❌ ERROR EN CONSULTA HOLDED:', error);
      return [];
    }

    console.log('✅ DATOS OBTENIDOS DE HOLDED:', data?.length, 'contactos');
    console.log('🔍 PRIMER CONTACTO COMPLETO:', data?.[0]);
    console.log('🔍 CAMPOS DISPONIBLES:', data?.[0] ? Object.keys(data[0]) : 'NO DATA');
    
    if (!data || data.length === 0) {
      console.log('⚠️ NO HAY DATOS EN HOLDED');
      return [];
    }

    // Procesar cada contacto individualmente
    const processedContacts = data.map((rawContact, index) => {
      console.log(`🔎 PROCESANDO CONTACTO ${index + 1}:`, {
        raw_data: rawContact,
        id_field: rawContact.id,
        holded_id_field: rawContact.holded_id,
        name_field: rawContact.name,
        name_type: typeof rawContact.name,
        name_length: rawContact.name?.length,
        code_field: rawContact.code,
        email_field: rawContact.email_original,
        vatnumber_field: rawContact.vatnumber
      });

      const processedContact: HoldedContact = {
        id: `holded_${rawContact.holded_id}`,
        holded_id: rawContact.holded_id,
        name: rawContact.name,
        email_original: rawContact.email_original,
        code: rawContact.code,
        vatnumber: rawContact.vatnumber,
        source: 'holded' as const
      };

      console.log(`✅ CONTACTO ${index + 1} PROCESADO:`, processedContact);
      return processedContact;
    });

    console.log('🎯 CONTACTOS FINALES PARA RETORNAR:', processedContacts.slice(0, 3));
    return processedContacts;
    
  } catch (error) {
    console.error('💥 ERROR FATAL EN fetchHoldedContacts:', error);
    return [];
  }
};

export const getHoldedContactById = async (holdedId: string): Promise<HoldedContact | null> => {
  try {
    console.log('🔍 Buscando contacto específico por ID:', holdedId);
    
    const { data, error } = await holdedSupabase
      .from("holded_contacts_index")
      .select("*")
      .eq("holded_id", holdedId)
      .maybeSingle();

    if (error || !data) {
      console.log('❌ No se encontró el contacto:', error);
      return null;
    }

    console.log('✅ Contacto encontrado:', data);

    return {
      id: `holded_${data.holded_id}`,
      holded_id: data.holded_id,
      name: data.name,
      email_original: data.email_original,
      code: data.code,
      vatnumber: data.vatnumber,
      source: 'holded'
    };
  } catch (error) {
    console.error('Error fetching Holded contact by ID:', error);
    return null;
  }
};