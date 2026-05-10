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
  isMaster?: boolean;
  localReferenceName?: string | null;
  associatedMasterFileId?: string | null;
  associatedMasterName?: string | null;
  associatedMasterReferenceName?: string | null;
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

      const apiFiles = Array.isArray(data) ? data : [];
      const { data: metaRows, error: metaError } = await supabase
        .from("excel_files")
        .select("id, file_id, filename, is_master, local_reference_name, associated_master_file_id");

      if (metaError) {
        throw new Error(metaError.message || "Error al obtener metadatos de archivos Excel");
      }

      const metaByApiId = new Map((metaRows || []).map((row: any) => [row.file_id, row]));
      const metaByRowOrApiId = new Map(
        (metaRows || []).flatMap((row: any) => [[row.id, row], [row.file_id, row]])
      );

      return apiFiles.map((file: any) => {
        const meta = metaByApiId.get(file.id);
        const associatedMasterMeta = meta?.associated_master_file_id
          ? metaByRowOrApiId.get(meta.associated_master_file_id)
          : null;

        return {
          ...file,
          isMaster: meta?.is_master || false,
          localReferenceName: meta?.local_reference_name || null,
          associatedMasterFileId: meta?.associated_master_file_id || null,
          associatedMasterName: associatedMasterMeta?.filename || null,
          associatedMasterReferenceName: associatedMasterMeta?.local_reference_name || null,
        };
      });
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options,
  });
}
