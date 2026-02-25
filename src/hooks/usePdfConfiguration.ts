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
  terms_page_text?: string;
  created_at?: string;
  updated_at?: string;
}

export const usePdfConfiguration = () => {
  const queryClient = useQueryClient();
  const { organization } = useSubscription();

  // Fetch configuration
  const { data: configuration, isLoading, error } = useQuery({
    queryKey: ['pdf-configuration', organization?.id],
    queryFn: async () => {
      if (!organization?.id) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('pdf_configurations')
        .select('*')
        .eq('organization_id', organization.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Save/Update configuration
  const saveMutation = useMutation({
    mutationFn: async (config: Partial<PdfConfiguration>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      if (!organization?.id) throw new Error('No organization found');

      const configData = {
        ...config,
        user_id: user.id,
        organization_id: organization.id,
      };

      // Try to find existing config for this org (any user)
      const { data: existing } = await supabase
        .from('pdf_configurations')
        .select('id')
        .eq('organization_id', organization.id)
        .limit(1)
        .maybeSingle();

      let result;
      if (existing?.id) {
        // Update existing org config
        const { data, error } = await supabase
          .from('pdf_configurations')
          .update(configData)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('pdf_configurations')
          .insert(configData)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      return result;
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
