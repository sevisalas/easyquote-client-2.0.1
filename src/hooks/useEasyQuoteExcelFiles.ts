import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEasyQuoteToken } from "@/lib/easyquoteApi";

export interface EasyQuoteExcelFile {
  id: string;
  fileName: string;
  fileSizeKb?: number;
  dateCreated?: string;
  dateModified?: string;
  isActive?: boolean;
  isPlanCompliant?: boolean;
  subscriberId?: string;
  excelfilesSheets?: any[];
  products?: any[];
}

export function useEasyQuoteExcelFiles(
  options: Partial<UseQueryOptions<EasyQuoteExcelFile[], Error>> = {},
) {
  return useQuery<EasyQuoteExcelFile[], Error>({
    queryKey: ["easyquote-excel-files"],
    queryFn: async () => {
      const token = await getEasyQuoteToken();
      if (!token) return [];

      const { data, error } = await supabase.functions.invoke("easyquote-excel-files", {
        body: { token },
      });

      if (error) {
        throw new Error(error.message || "Error al obtener archivos Excel");
      }

      return Array.isArray(data) ? data : [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}
