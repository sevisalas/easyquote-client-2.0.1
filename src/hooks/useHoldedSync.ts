import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from '@/hooks/use-toast';

interface SyncStatus {
  isRunning: boolean;
  progress: string;
  error?: string;
}

export const useHoldedSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isRunning: false,
    progress: ''
  });
  const { organization, membership } = useSubscription();

  const currentOrganization = organization || membership?.organization;

  const startFullSync = async (fullSync = false) => {
    if (!currentOrganization?.id) {
      toast({
        title: "Error",
        description: "No se pudo identificar la organización",
        variant: "destructive"
      });
      return;
    }

    setSyncStatus({
      isRunning: true,
      progress: 'Iniciando sincronización...'
    });

    try {
      const { data, error } = await supabase.functions.invoke('holded-sync-all-customers', {
        body: { 
          organizationId: currentOrganization.id,
          fullSync 
        }
      });

      if (error) {
        console.error('Error starting Holded sync:', error);
        setSyncStatus({
          isRunning: false,
          progress: '',
          error: error.message || 'Error al iniciar la sincronización'
        });

        toast({
          title: "Error en sincronización",
          description: error.message || 'No se pudo iniciar la sincronización con Holded',
          variant: "destructive"
        });
        return;
      }

      // Show success message
      toast({
        title: "Sincronización iniciada",
        description: `Se está sincronizando con Holded en segundo plano. ${data?.estimatedContacts || 22000} contactos estimados.`,
        duration: 6000
      });

      setSyncStatus({
        isRunning: false,
        progress: `Sincronización en curso: ${data?.totalPages || 44} páginas`
      });

      // Reset status after some time
      setTimeout(() => {
        setSyncStatus({
          isRunning: false,
          progress: ''
        });
      }, 10000);

    } catch (error) {
      console.error('Error calling Holded sync function:', error);
      setSyncStatus({
        isRunning: false,
        progress: '',
        error: 'Error inesperado al sincronizar'
      });

      toast({
        title: "Error",
        description: "Error inesperado al iniciar la sincronización",
        variant: "destructive"
      });
    }
  };

  const startIncrementalSync = () => startFullSync(false);
  const startCompleteSync = () => startFullSync(true);

  return {
    syncStatus,
    startIncrementalSync,
    startCompleteSync
  };
};