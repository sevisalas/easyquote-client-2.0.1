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

      // Validate that items with multiple quantities have a selected quantity
      for (const item of itemsToApprove) {
        const multi = item.multi as any;
        if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1) {
          if (!itemQuantities || !itemQuantities[item.id]) {
            throw new Error('Debes seleccionar una cantidad para cada item con múltiples opciones');
          }
        }
      }

      // Generate sales order number (format: SO-YYYY-NNNN)
      const year = new Date().getFullYear();
      
      const { data: yearOrders } = await supabase
        .from('sales_orders')
        .select('order_number')
        .like('order_number', `SO-${year}-%`)
        .order('order_number', { ascending: false })
        .limit(1);

      let sequentialNumber = 1;
      if (yearOrders && yearOrders.length > 0) {
        const lastNumber = yearOrders[0].order_number;
        const parts = lastNumber.split('-');
        if (parts.length === 3) {
          sequentialNumber = parseInt(parts[2]) + 1;
        }
      }

      const orderNumber = `SO-${year}-${String(sequentialNumber).padStart(4, '0')}`;

      // Fetch quote additionals
      const { data: quoteAdditionals } = await supabase
        .from('quote_additionals')
        .select('*')
        .eq('quote_id', quoteId);

      // Calculate totals - use EXACT quote totals, only recalculate item subtotal
      let itemsSubtotal = 0;
      for (const item of itemsToApprove) {
        const multi = item.multi as any;
        let itemPrice = item.price || 0;
        let itemQuantity = item.quantity || 1;

        // If multi with selected quantity, use that specific price
        if (multi?.rows && Array.isArray(multi.rows) && itemQuantities?.[item.id]) {
          const selectedQuantity = itemQuantities[item.id];
          const selectedRow = multi.rows.find((row: any) => row.quantity === selectedQuantity);
          if (selectedRow) {
            itemPrice = selectedRow.price || 0;
            itemQuantity = selectedQuantity;
          }
        }

        itemsSubtotal += itemPrice;
      }

      // Use quote's original totals structure
      const subtotal = itemsSubtotal;
      const taxAmount = quote.tax_amount || 0;
      const discountAmount = quote.discount_amount || 0;
      const finalPrice = subtotal + taxAmount - discountAmount;

      // Create sales order - EXACT COPY of quote
      const { data: salesOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          order_number: orderNumber,
          quote_id: quoteId,
          customer_id: quote.customer_id,
          user_id: quote.user_id,
          status: 'pending',
          title: quote.title,
          description: quote.description,
          terms_conditions: quote.terms_conditions,
          valid_until: quote.valid_until,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          final_price: finalPrice,
          notes: quote.notes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Copy quote additionals to sales order additionals
      if (quoteAdditionals && quoteAdditionals.length > 0) {
        const orderAdditionals = quoteAdditionals.map((qa: any) => ({
          sales_order_id: salesOrder.id,
          additional_id: qa.additional_id,
          name: qa.name,
          type: qa.type,
          value: qa.value,
          is_discount: qa.is_discount,
        }));

        const { error: additionalsError } = await supabase
          .from('sales_order_additionals')
          .insert(orderAdditionals);

        if (additionalsError) throw additionalsError;
      }

      // Create sales order items with selected quantities
      const orderItems = itemsToApprove.map((item: any, index: number) => {
        const multi = item.multi as any;
        let finalQuantity = item.quantity || 1;
        let finalPrice = item.price || 0;
        let finalMulti = item.multi;

        // If multi with selected quantity, only keep that option
        if (multi?.rows && Array.isArray(multi.rows) && itemQuantities?.[item.id]) {
          const selectedQuantity = itemQuantities[item.id];
          const selectedRow = multi.rows.find((row: any) => 
            row.qty === selectedQuantity || row.quantity === selectedQuantity
          );
          
          if (selectedRow) {
            finalQuantity = selectedQuantity;
            finalPrice = parseFloat(selectedRow.outs?.find((o: any) => o.type === 'Price')?.value || selectedRow.price || item.price || 0);
            // Keep only the selected row in multi
            finalMulti = {
              ...multi,
              rows: [selectedRow]
            };
          }
        }

        return {
          sales_order_id: salesOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          description: item.description,
          quantity: finalQuantity,
          price: finalPrice,
          outputs: item.outputs,
          prompts: item.prompts,
          multi: finalMulti,
          position: index,
        };
      });

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Mark quote items as accepted with selected quantity
      const itemUpdates = itemsToApprove.map((item: any) => ({
        id: item.id,
        accepted: true,
        accepted_quantity: itemQuantities?.[item.id] || item.quantity || 1
      }));

      for (const update of itemUpdates) {
        const { error: updateItemError } = await supabase
          .from('quote_items')
          .update({ 
            accepted: update.accepted,
            accepted_quantity: update.accepted_quantity 
          })
          .eq('id', update.id);
        
        if (updateItemError) throw updateItemError;
      }

      const updateItemsError = null; // For compatibility

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
