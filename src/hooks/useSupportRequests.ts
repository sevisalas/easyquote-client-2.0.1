import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "sonner";

export type SupportRequestType = 'feature' | 'bug' | 'question';
export type SupportRequestStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

export interface SupportRequest {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: SupportRequestType;
  title: string;
  description: string;
  status: SupportRequestStatus;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSupportRequests() {
  const { isSuperAdmin, organization } = useSubscription();
  const queryClient = useQueryClient();

  // Fetch requests (user sees their own, superadmin sees all)
  const { data: requests, isLoading } = useQuery({
    queryKey: ['support-requests', isSuperAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SupportRequest[];
    }
  });

  // Create new request
  const createRequest = useMutation({
    mutationFn: async (request: {
      type: SupportRequestType;
      title: string;
      description: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data, error } = await supabase
        .from('support_requests')
        .insert({
          user_id: user.id,
          organization_id: organization?.id || null,
          type: request.type,
          title: request.title,
          description: request.description
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      toast.success('Solicitud enviada correctamente');
    },
    onError: (error) => {
      toast.error('Error al enviar la solicitud: ' + error.message);
    }
  });

  // Update request status (superadmin only)
  const updateRequest = useMutation({
    mutationFn: async (update: {
      id: string;
      status: SupportRequestStatus;
      admin_notes?: string;
    }) => {
      const updateData: Record<string, unknown> = {
        status: update.status,
        admin_notes: update.admin_notes
      };

      if (update.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('support_requests')
        .update(updateData)
        .eq('id', update.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      toast.success('Solicitud actualizada');
    },
    onError: (error) => {
      toast.error('Error al actualizar: ' + error.message);
    }
  });

  // Delete request (superadmin only)
  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('support_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      toast.success('Solicitud eliminada');
    },
    onError: (error) => {
      toast.error('Error al eliminar: ' + error.message);
    }
  });

  return {
    requests,
    isLoading,
    createRequest,
    updateRequest,
    deleteRequest
  };
}
