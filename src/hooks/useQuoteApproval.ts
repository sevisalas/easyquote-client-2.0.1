import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useHoldedIntegration } from "@/hooks/useHoldedIntegration";

interface ApproveQuoteParams {
  quoteId: string;
  selectedItemIds?: string[]; // If empty, approve all
  itemQuantities?: Record<string, number>; // itemId -> selected quantity
}

export const useQuoteApproval = () => {
  const { toast } = useToast();
  const { membership, organization } = useSubscription();
  const { canExportOrders, canExportQuotes } = useHoldedIntegration();
  const [loading, setLoading] = useState(false);

  const approveQuote = async ({ quoteId, selectedItemIds, itemQuantities }: ApproveQuoteParams) => {
    try {
      setLoading(true);

      // Check user role
      const userRole = membership?.role;
      if (!userRole || !['admin', 'gestor', 'comercial'].includes(userRole)) {
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

      // Generate sales order number based on configured format
      const organizationId = quote.organization_id || sessionStorage.getItem('selected_organization_id');
      
      // Get numbering format for orders
      const { data: orderFormat } = await supabase
        .from('numbering_formats')
        .select('*')
        .eq('document_type', 'order')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      // Build prefix with year if configured
      let prefix = orderFormat?.prefix || 'SO-';
      const useYear = orderFormat?.use_year ?? true;
      const yearFormat = orderFormat?.year_format || 'YYYY';
      const sequentialDigits = orderFormat?.sequential_digits || 4;
      const suffix = orderFormat?.suffix || '';
      
      if (useYear) {
        const year = new Date().getFullYear();
        const yearStr = yearFormat === 'YY' ? year.toString().slice(-2) : year.toString();
        prefix += yearStr + '-';
      }
      
      // Query existing orders with this prefix in this organization
      const { data: existingOrders } = await supabase
        .from('sales_orders')
        .select('order_number')
        .eq('organization_id', organizationId)
        .like('order_number', `${prefix}%`)
        .order('order_number', { ascending: false })
        .limit(100);
      
      // Extract max sequential number
      let maxSequential = 0;
      for (const order of existingOrders || []) {
        const on = order.order_number || '';
        let seqPart = on.replace(prefix, '');
        if (suffix && seqPart.endsWith(suffix)) {
          seqPart = seqPart.slice(0, -suffix.length);
        }
        const seqNum = parseInt(seqPart, 10);
        if (!isNaN(seqNum) && seqNum > maxSequential) {
          maxSequential = seqNum;
        }
      }
      
      const nextSequential = maxSequential + 1;
      let orderNumber = prefix + nextSequential.toString().padStart(sequentialDigits, '0');
      if (suffix) {
        orderNumber += suffix;
      }
      
      console.log(`📋 Approval order numbering: prefix="${prefix}", maxFound=${maxSequential}, next=${nextSequential}, number="${orderNumber}"`);

      // Fetch quote additionals
      const { data: quoteAdditionals } = await supabase
        .from('quote_additionals')
        .select('*')
        .eq('quote_id', quoteId);

      // Calculate subtotal from selected items
      let subtotal = 0;
      for (const item of itemsToApprove) {
        const multi = item.multi as any;
        let itemPrice = item.price || 0;

        // If multi with selected quantity, use that specific price
        if (multi?.rows && Array.isArray(multi.rows) && itemQuantities?.[item.id]) {
          const selectedQuantity = itemQuantities[item.id];
          const selectedRow = multi.rows.find((row: any) => 
            row.qty === selectedQuantity || row.quantity === selectedQuantity
          );
          if (selectedRow) {
            itemPrice = parseFloat(selectedRow.outs?.find((o: any) => o.type === 'Price')?.value || selectedRow.price || item.price || 0);
          }
        }

        subtotal += itemPrice;
      }

      // Calculate additionals
      let discountAmount = 0;
      let taxAmount = 0;
      
      if (quoteAdditionals && quoteAdditionals.length > 0) {
        for (const additional of quoteAdditionals) {
          if (additional.is_discount) {
            if (additional.type === 'percentage') {
              discountAmount += (subtotal * additional.value) / 100;
            } else {
              discountAmount += additional.value;
            }
          } else {
            if (additional.type === 'percentage') {
              taxAmount += (subtotal * additional.value) / 100;
            } else {
              taxAmount += additional.value;
            }
          }
        }
      }

      const finalPrice = subtotal - discountAmount + taxAmount;

      // Create sales order - EXACT COPY of quote (mark as NOT from scratch)
      // Note: sales_orders table does NOT have a 'title' column
      const { data: salesOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          order_number: orderNumber,
          quote_id: quoteId,
          customer_id: quote.customer_id,
          user_id: quote.user_id,
          organization_id: quote.organization_id,
          status: 'pending',
          description: quote.description,
          terms_conditions: quote.terms_conditions,
          valid_until: quote.valid_until,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          final_price: finalPrice,
          notes: quote.notes,
          created_from_scratch: false,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Update last_sequential_number in numbering_formats
      if (orderFormat?.id) {
        await supabase
          .from('numbering_formats')
          .update({ last_sequential_number: nextSequential })
          .eq('id', orderFormat.id);
      }
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

      // Create sales order items - EXACT COPY from quote items
      const orderItems = itemsToApprove.map((item: any, index: number) => {
        const multi = item.multi as any;
        let finalQuantity = item.quantity || 1;
        let finalPrice = item.price || 0;
        let finalMulti = item.multi;

        // ONLY modify if user explicitly selected a quantity from multi options
        if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1 && itemQuantities?.[item.id]) {
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

        // If there's only one row in multi, use that row's quantity and price
        if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length === 1) {
          const singleRow = multi.rows[0];
          finalQuantity = singleRow.qty || singleRow.quantity || item.quantity || 1;
          finalPrice = parseFloat(singleRow.outs?.find((o: any) => o.type === 'Price')?.value || singleRow.price || item.price || 0);
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

      if (itemsError) {
        // Rollback: delete the sales order if items failed
        await supabase.from('sales_orders').delete().eq('id', salesOrder.id);
        throw itemsError;
      }

      // Copy document attachments from quote to sales order
      try {
        const { data: quoteAttachments } = await (supabase
          .from('document_attachments' as any)
          .select('*')
          .eq('quote_id', quoteId) as any);

        if (quoteAttachments && quoteAttachments.length > 0) {
          const orderAttachments = quoteAttachments.map((att: any) => ({
            organization_id: att.organization_id,
            sales_order_id: salesOrder.id,
            file_name: att.file_name,
            file_path: att.file_path, // Reuse same storage file
            file_size: att.file_size,
            mime_type: att.mime_type,
            created_by: att.created_by,
          }));

          await (supabase
            .from('document_attachments' as any)
            .insert(orderAttachments) as any);

          console.log(`📎 Copied ${quoteAttachments.length} attachments from quote to order`);
        }
      } catch (attachErr) {
        console.error('Error copying attachments (non-fatal):', attachErr);
      }

      // Update quote status to approved ONLY after order and items are created successfully
      const { error: updateQuoteError } = await supabase
        .from('quotes')
        .update({ status: 'approved' })
        .eq('id', quoteId);

      if (updateQuoteError) {
        console.error('Error updating quote status, but order was created:', updateQuoteError);
        // Don't throw - the order was created successfully
      }

      // Export quote (estimate) to Holded with only approved items
      if (canExportQuotes) {
        try {
          console.log('🚀 Exporting estimate to Holded:', quoteId);
          const { error: estimateError } = await supabase.functions.invoke('holded-export-estimate', {
            body: { quoteId }
          });
          if (estimateError) {
            console.error('❌ Error exporting estimate to Holded:', estimateError);
          } else {
            console.log('✅ Successfully exported estimate to Holded');
          }
        } catch (estimateErr) {
          console.error('Error exporting estimate to Holded:', estimateErr);
        }
      }

      // Export order to Holded if integration is active
      if (canExportOrders) {
        try {
          console.log('🚀 Exporting new order to Holded:', salesOrder.id);
          const { error: holdedError } = await supabase.functions.invoke('holded-export-order', {
            body: { orderId: salesOrder.id }
          });

          if (holdedError) {
            console.error('❌ Error exporting to Holded:', holdedError);
            toast({
              title: "Presupuesto aprobado",
              description: `Pedido ${orderNumber} creado, pero hubo un error al exportar a Holded`,
              variant: "default",
            });
          } else {
            console.log('✅ Successfully exported to Holded');
            toast({
              title: "Presupuesto aprobado y exportado",
              description: `Presupuesto ${quote.quote_number} → Pedido ${orderNumber} (exportado a Holded)`,
            });
          }
        } catch (holdedError) {
          console.error('Error exporting to Holded:', holdedError);
          toast({
            title: "Presupuesto aprobado",
            description: `Pedido ${orderNumber} creado, pero hubo un error al exportar a Holded`,
            variant: "default",
          });
        }
      } else {
        toast({
          title: "Presupuesto aprobado",
          description: `Presupuesto ${quote.quote_number} → Pedido ${orderNumber}`,
        });
      }

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
