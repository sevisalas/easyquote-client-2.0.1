import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface ApproveQuoteParams {
  quoteId: string;
  selectedItemIds?: string[]; // If empty, approve all
}

export const useQuoteApproval = () => {
  const { toast } = useToast();
  const { membership } = useSubscription();
  const [loading, setLoading] = useState(false);

  const approveQuote = async ({ quoteId, selectedItemIds }: ApproveQuoteParams) => {
    try {
      setLoading(true);

      // Check user role
      const userRole = membership?.role;
      if (!userRole || !['admin', 'comercial'].includes(userRole)) {
        throw new Error('No tienes permisos para aprobar presupuestos');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Fetch quote with items
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;
      if (!quote) throw new Error('Presupuesto no encontrado');

      // Check permissions: comercial can only approve their own quotes
      if (userRole === 'comercial' && quote.user_id !== user.id) {
        throw new Error('Solo puedes aprobar tus propios presupuestos');
      }

      // Determine which items to approve
      const itemsToApprove = selectedItemIds && selectedItemIds.length > 0
        ? quote.items.filter((item: any) => selectedItemIds.includes(item.id))
        : quote.items;

      if (!itemsToApprove || itemsToApprove.length === 0) {
        throw new Error('No hay items para aprobar');
      }

      // Generate sales order number
      const today = new Date();
      const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      const { data: todayOrders } = await supabase
        .from('sales_orders')
        .select('order_number')
        .like('order_number', `SO-${datePrefix}%`)
        .order('order_number', { ascending: false })
        .limit(1);

      let dailyNumber = 1;
      if (todayOrders && todayOrders.length > 0) {
        const lastNumber = todayOrders[0].order_number;
        const parts = lastNumber.split('-');
        if (parts.length === 3) {
          dailyNumber = parseInt(parts[2]) + 1;
        }
      }

      const orderNumber = `SO-${datePrefix}-${String(dailyNumber).padStart(4, '0')}`;

      // Calculate totals for approved items
      const subtotal = itemsToApprove.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
      const taxAmount = 0; // You can calculate tax if needed
      const discountAmount = 0;
      const finalPrice = subtotal + taxAmount - discountAmount;

      // Create sales order
      const { data: salesOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          order_number: orderNumber,
          quote_id: quoteId,
          customer_id: quote.customer_id,
          user_id: quote.user_id,
          status: 'pending',
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          final_price: finalPrice,
          notes: quote.notes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create sales order items
      const orderItems = itemsToApprove.map((item: any, index: number) => ({
        sales_order_id: salesOrder.id,
        product_id: item.product_id,
        product_name: item.product_name,
        description: item.description,
        quantity: item.quantity || 1,
        price: item.price,
        outputs: item.outputs,
        prompts: item.prompts,
        multi: item.multi,
        position: index,
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Mark quote items as accepted
      const { error: updateItemsError } = await supabase
        .from('quote_items')
        .update({ accepted: true })
        .in('id', itemsToApprove.map((item: any) => item.id));

      if (updateItemsError) throw updateItemsError;

      // If all items approved, update quote status
      const allItemsApproved = quote.items.every((item: any) => 
        itemsToApprove.find((i: any) => i.id === item.id) || item.accepted
      );

      if (allItemsApproved) {
        const { error: updateQuoteError } = await supabase
          .from('quotes')
          .update({ status: 'approved' })
          .eq('id', quoteId);

        if (updateQuoteError) throw updateQuoteError;
      }

      toast({
        title: "Presupuesto aprobado",
        description: `Se creó el pedido ${orderNumber}`,
      });

      return salesOrder;
    } catch (error: any) {
      console.error('Error approving quote:', error);
      toast({
        title: "Error al aprobar",
        description: error.message || "No se pudo aprobar el presupuesto",
        variant: "destructive",
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
