import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface ApproveQuoteParams {
  quoteId: string;
  selectedItemIds?: string[]; // If empty, approve all
  itemQuantities?: Record<string, number>; // itemId -> selected quantity
}

export const useQuoteApproval = () => {
  const { toast } = useToast();
  const { membership } = useSubscription();
  const [loading, setLoading] = useState(false);

  const approveQuote = async ({ quoteId, selectedItemIds, itemQuantities }: ApproveQuoteParams) => {
    try {
      setLoading(true);

      // Check user role (UI-side gate; edge function enforces tenant/org rules)
      const userRole = membership?.role;
      if (!userRole || !['admin', 'gestor', 'comercial'].includes(userRole)) {
        throw new Error('No tienes permisos para aprobar presupuestos');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Comercial can only approve their own quotes
      if (userRole === 'comercial') {
        const { data: q } = await supabase
          .from('quotes')
          .select('user_id, quote_number')
          .eq('id', quoteId)
          .maybeSingle();
        if (q && q.user_id !== user.id) {
          throw new Error('Solo puedes aprobar tus propios presupuestos');
        }
      }

      // Delegate to the edge function so app and portal share the SAME approval logic
      const { data, error } = await supabase.functions.invoke('approve-quote', {
        body: {
          quoteId,
          selectedItemIds: selectedItemIds && selectedItemIds.length > 0 ? selectedItemIds : undefined,
          itemQuantities: itemQuantities && Object.keys(itemQuantities).length > 0 ? itemQuantities : undefined,
        },
      });

      if (error) throw new Error(error.message || 'Error aprobando el presupuesto');
      if (data?.error) throw new Error(data.error);

      const orderNumber = data?.orderNumber || data?.salesOrder?.order_number;
      toast({
        title: 'Presupuesto aprobado',
        description: orderNumber ? `Pedido ${orderNumber} creado` : 'Pedido creado correctamente',
      });

      return data?.salesOrder ?? null;
    } catch (error: any) {
      console.error('Error approving quote:', error);
      toast({
        title: 'Error al aprobar',
        description: error.message || 'No se pudo aprobar el presupuesto',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    approveQuote,
    loading,
  };
};
