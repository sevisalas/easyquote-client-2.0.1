import { useQuery } from '@tanstack/react-query';
import { fetchAvailableTemplates } from '@/utils/templateRegistry';

export const usePdfTemplates = () => {
  return useQuery({
    queryKey: ['pdf-templates'],
    queryFn: fetchAvailableTemplates,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
