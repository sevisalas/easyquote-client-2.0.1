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

      const getSequenceLastNumber = async (
        organizationId: string,
        useYear: boolean,
      ): Promise<number> => {
        const yearBucket = useYear ? new Date().getFullYear() : 0;
        const { data: sequenceData, error: sequenceError } = await supabase
          .from('document_sequences')
          .select('last_number')
          .eq('organization_id', organizationId)
          .eq('document_type', documentType)
          .eq('year', yearBucket)
          .maybeSingle();

        if (sequenceError) {
          console.warn('📋 Error reading document sequence:', sequenceError);
          return 0;
        }

        return sequenceData?.last_number ?? 0;
      };

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

        if (orgFormat) {
          const sequenceLast = await getSequenceLastNumber(organizationId, orgFormat.use_year);
          return {
            ...orgFormat,
            last_sequential_number: Math.max(orgFormat.last_sequential_number ?? 0, sequenceLast),
          } as NumberingFormat;
        }
      }

      // Try to get user-specific format (legacy support only when organization_id is null)
      const { data, error } = await supabase
        .from('numbering_formats')
        .select('*')
        .eq('document_type', documentType)
        .eq('user_id', user.id)
        .is('organization_id', null)
        .maybeSingle();

      console.log('📋 User format found:', data, 'Error:', error);

      if (error) throw error;

      // Return default format if none configured
      if (!data) {
        const defaultFormat = {
          prefix: documentType === 'quote' ? '' : 'SO-',
          suffix: '',
          use_year: true,
          year_format: documentType === 'quote' ? 'YY' : 'YYYY',
          sequential_digits: 4,
          last_sequential_number: 0,
        } as Omit<NumberingFormat, 'id' | 'document_type'>;

        if (organizationId) {
          const sequenceLast = await getSequenceLastNumber(organizationId, defaultFormat.use_year);
          defaultFormat.last_sequential_number = sequenceLast;
        }

        console.warn('📋 No numbering format found, using defaults');
        return defaultFormat;
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
