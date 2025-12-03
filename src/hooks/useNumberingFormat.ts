import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NumberingFormat {
  id: string;
  document_type: 'quote' | 'order';
  prefix: string;
  suffix: string;
  use_year: boolean;
  year_format: 'YY' | 'YYYY';
  sequential_digits: number;
  last_sequential_number: number;
  organization_id?: string;
}

export const useNumberingFormat = (documentType: 'quote' | 'order') => {
  return useQuery({
    queryKey: ['numbering-format', documentType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Use the selected organization from sessionStorage (same as SubscriptionContext)
      const savedOrgId = sessionStorage.getItem('selected_organization_id');
      let organizationId: string | null = savedOrgId;

      // If no saved org, try to determine it
      if (!organizationId) {
        // First check if user is organization owner (use limit 1 for multiple orgs)
        const { data: ownedOrgs } = await supabase
          .from('organizations')
          .select('id')
          .eq('api_user_id', user.id)
          .limit(1);

        if (ownedOrgs && ownedOrgs.length > 0) {
          organizationId = ownedOrgs[0].id;
        } else {
          // Then check if user is organization member
          const { data: orgMembers } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1);

          if (orgMembers && orgMembers.length > 0) {
            organizationId = orgMembers[0].organization_id;
          }
        }
      }

      console.log('📋 Numbering format - Organization ID:', organizationId, 'Document type:', documentType);

      // Update last sequential number from database before returning format
      await supabase.rpc('update_last_sequential_number', {
        p_user_id: user.id,
        p_document_type: documentType
      });

      // If user belongs to an organization, get format for that organization
      if (organizationId) {
        const { data: orgFormat, error: orgError } = await supabase
          .from('numbering_formats')
          .select('*')
          .eq('document_type', documentType)
          .eq('organization_id', organizationId)
          .maybeSingle();

        console.log('📋 Org format found:', orgFormat, 'Error:', orgError);

        if (orgError) throw orgError;
        if (orgFormat) return orgFormat as NumberingFormat;
      }

      // Try to get user-specific format (legacy support)
      const { data, error } = await supabase
        .from('numbering_formats')
        .select('*')
        .eq('document_type', documentType)
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('📋 User format found:', data, 'Error:', error);

      if (error) throw error;
      
      // Return default format if none configured
      if (!data) {
        console.warn('📋 No numbering format found, using defaults');
        return {
          prefix: documentType === 'quote' ? '' : 'SO-',
          suffix: '',
          use_year: true,
          year_format: documentType === 'quote' ? 'YY' : 'YYYY',
          sequential_digits: 4,
          last_sequential_number: 1
        } as Omit<NumberingFormat, 'id' | 'document_type'>;
      }

      return data as NumberingFormat;
    },
  });
};

export const generateDocumentNumber = (
  format: Omit<NumberingFormat, 'id' | 'document_type'>,
  sequentialNumber: number
): string => {
  let number = format.prefix;
  
  if (format.use_year) {
    const year = new Date().getFullYear();
    const yearStr = format.year_format === 'YY' 
      ? year.toString().slice(-2) 
      : year.toString();
    number += yearStr + '-';
  }
  
  number += sequentialNumber.toString().padStart(format.sequential_digits, '0');
  
  if (format.suffix) {
    number += format.suffix;
  }
  
  return number;
};
