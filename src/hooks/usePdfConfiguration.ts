import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';

export interface PdfConfiguration {
  id?: string;
  user_id: string;
  organization_id?: string;
  company_name?: string;
  logo_url?: string;
  brand_color?: string;
  footer_text?: string;
  selected_template: number;
  created_at?: string;
  updated_at?: string;
}

export const usePdfConfiguration = () => {
  const queryClient = useQueryClient();
  const { organization } = useSubscription();

  // Fetch configuration
  const { data: configuration, isLoading, error } = useQuery({
    queryKey: ['pdf-configuration'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('pdf_configurations')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Save/Update configuration
  const saveMutation = useMutation({
    mutationFn: async (config: Partial<PdfConfiguration>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const configData = {
        ...config,
        user_id: user.id,
        organization_id: organization?.id,
      };

      const { data, error } = await supabase
        .from('pdf_configurations')
        .upsert(configData, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-configuration'] });
      toast.success('Configuración guardada correctamente');
    },
    onError: (error: any) => {
      console.error('Error saving PDF configuration:', error);
      toast.error('Error al guardar la configuración');
    },
  });

  return {
    configuration,
    isLoading,
    error,
    saveConfiguration: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
};
