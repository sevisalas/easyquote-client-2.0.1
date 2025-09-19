import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHoldedIntegration } from './useHoldedIntegration';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  holded_id?: string;
  created_at: string;
}

interface SearchResult {
  customers: Customer[];
  loading: boolean;
  hasMore: boolean;
  totalCount?: number;
}

export const useCustomerSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult>({
    customers: [],
    loading: false,
    hasMore: false
  });
  const [page, setPage] = useState(0);
  const { isHoldedActive, getHoldedContacts } = useHoldedIntegration();

  const searchCustomers = useCallback(async (
    term: string, 
    pageNumber = 0, 
    appendResults = false
  ) => {
    if (!term.trim() && pageNumber === 0) {
      setSearchResult({ customers: [], loading: false, hasMore: false });
      return;
    }

    setSearchResult(prev => ({ ...prev, loading: true }));

    try {
      if (isHoldedActive && term.trim()) {
        // Para cuentas con Holded, buscar directamente en API
        const holdedContacts = await getHoldedContacts();
        const filteredContacts = holdedContacts
          .filter(contact => 
            contact.name.toLowerCase().includes(term.toLowerCase()) ||
            (contact.email && contact.email.toLowerCase().includes(term.toLowerCase()))
          )
          .slice(0, 50); // Limitar a 50 resultados para UX

        const mappedCustomers: Customer[] = filteredContacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          holded_id: contact.id,
          created_at: new Date().toISOString()
        }));

        setSearchResult({
          customers: mappedCustomers,
          loading: false,
          hasMore: filteredContacts.length === 50,
          totalCount: filteredContacts.length
        });
      } else {
        // Para cuentas sin Holded, buscar en base de datos local
        const { data, error } = await supabase.rpc('search_customers', {
          search_term: term.trim(),
          user_uuid: (await supabase.auth.getUser()).data.user?.id,
          page_limit: 50,
          page_offset: pageNumber * 50
        });

        if (error) {
          console.error('Error searching customers:', error);
          setSearchResult(prev => ({ ...prev, loading: false }));
          return;
        }

        const newCustomers = data || [];
        
        setSearchResult(prev => ({
          customers: appendResults ? [...prev.customers, ...newCustomers] : newCustomers,
          loading: false,
          hasMore: newCustomers.length === 50,
          totalCount: appendResults ? prev.totalCount : newCustomers.length
        }));
      }
    } catch (error) {
      console.error('Error in customer search:', error);
      setSearchResult(prev => ({ ...prev, loading: false }));
    }
  }, [isHoldedActive, getHoldedContacts]);

  const loadMore = useCallback(() => {
    if (!searchResult.loading && searchResult.hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      searchCustomers(searchTerm, nextPage, true);
    }
  }, [searchResult.loading, searchResult.hasMore, page, searchTerm, searchCustomers]);

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(0);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchCustomers(term, 0, false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchCustomers]);

  // Buscar automáticamente cuando cambia el término
  useEffect(() => {
    const cleanup = handleSearchChange(searchTerm);
    return cleanup;
  }, [handleSearchChange, searchTerm]);

  const selectCustomer = useCallback((customer: Customer) => {
    // Si es de Holded y no existe localmente, crearlo
    if (customer.holded_id && !isHoldedActive) {
      return customer;
    }
    return customer;
  }, [isHoldedActive]);

  return {
    searchTerm,
    setSearchTerm,
    searchResult,
    loadMore,
    selectCustomer,
    isHoldedIntegration: isHoldedActive
  };
};