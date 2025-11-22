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
}

export const useNumberingFormat = (documentType: 'quote' | 'order') => {
  return useQuery({
    queryKey: ['numbering-format', documentType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // First, try to get the organization_id if user is a member
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Query with both user_id and organization_id to get the most specific format
      let query = supabase
        .from('numbering_formats')
        .select('*')
        .eq('document_type', documentType);

      if (orgMember?.organization_id) {
        // If user is in an organization, prioritize org format
        query = query.or(`organization_id.eq.${orgMember.organization_id},and(user_id.eq.${user.id},organization_id.is.null)`);
      } else {
        // Otherwise just use user_id
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) throw error;
      
      // Return default format if none configured
      if (!data) {
        return {
          prefix: documentType === 'quote' ? 'PRES-' : 'SO-',
          suffix: '',
          use_year: true,
          year_format: 'YYYY',
          sequential_digits: 4
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
    number += yearStr;
  }
  
  number += '-' + sequentialNumber.toString().padStart(format.sequential_digits, '0');
  
  if (format.suffix) {
    number += format.suffix;
  }
  
  return number;
};
