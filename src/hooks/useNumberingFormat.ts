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
}

export const useNumberingFormat = (documentType: 'quote' | 'order') => {
  return useQuery({
    queryKey: ['numbering-format', documentType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // First, check if user is organization owner
      const { data: ownedOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('api_user_id', user.id)
        .maybeSingle();

      // Then check if user is organization member
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const organizationId = ownedOrg?.id || orgMember?.organization_id;

      // If user belongs to an organization, get format for that organization
      if (organizationId) {
        const { data: orgFormat, error: orgError } = await supabase
          .from('numbering_formats')
          .select('*')
          .eq('document_type', documentType)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (orgError) throw orgError;
        if (orgFormat) return orgFormat as NumberingFormat;
      }

      // Otherwise, get user-specific format
      const { data, error } = await supabase
        .from('numbering_formats')
        .select('*')
        .eq('document_type', documentType)
        .eq('user_id', user.id)
        .is('organization_id', null)
        .maybeSingle();

      if (error) throw error;
      
      // Return default format if none configured
      if (!data) {
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
