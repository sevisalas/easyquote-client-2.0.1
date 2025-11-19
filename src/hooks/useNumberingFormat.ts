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

      const { data, error } = await supabase
        .from('numbering_formats')
        .select('*')
        .eq('document_type', documentType)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Return default format if none configured
      if (!data) {
        return {
          prefix: documentType === 'quote' ? '' : 'SO-',
          suffix: '',
          use_year: true,
          year_format: documentType === 'quote' ? 'YY' : 'YYYY',
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
