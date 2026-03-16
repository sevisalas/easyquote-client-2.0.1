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
  const { canExportOrders, canExportQuotesOnApproval } = useHoldedIntegration();
  const [loading, setLoading] = useState(false);

  /**
   * Resolves the final quantity and price for an item, considering multi-quantity selections.
   */
  const resolveItemQuantityAndPrice = (item: any, itemQuantities?: Record<string, number>) => {
    const multi = item.multi as any;
    let finalQuantity = item.quantity || 1;
    let finalPrice = item.price || 0;
    let finalMulti = item.multi;

    // ONLY modify if user explicitly selected a quantity from multi options
    if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1 && itemQuantities?.[item.id]) {
      const selectedQuantity = itemQuantities[item.id];
      const selectedRow = multi.rows.find((row: any) => 
        Number(row.qty) === selectedQuantity || Number(row.quantity) === selectedQuantity
      );
      
      if (selectedRow) {
        finalQuantity = selectedQuantity;
        finalPrice = parseFloat(selectedRow.outs?.find((o: any) => o.type === 'Price')?.value || selectedRow.price || item.price || 0);
        finalMulti = { ...multi, rows: [selectedRow] };
      }
    }

    // If there's only one row in multi, use that row's quantity and price
    if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length === 1) {
      const singleRow = multi.rows[0];
      finalQuantity = singleRow.qty || singleRow.quantity || item.quantity || 1;
      finalPrice = parseFloat(singleRow.outs?.find((o: any) => o.type === 'Price')?.value || singleRow.price || item.price || 0);
    }

    return { finalQuantity, finalPrice, finalMulti };
  };

  /**
   * Creates a single sales order for one or more items.
   * Returns the created order.
   */
  const createSalesOrderForItems = async (
    quote: any,
    items: any[],
    itemQuantities: Record<string, number> | undefined,
    organizationId: string,
    quoteAdditionals: any[] | null,
    orderNumberOverride?: string,
  ) => {
    // Generate order number
    let orderNumber = orderNumberOverride;
    if (!orderNumber) {
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { data: docNumber, error: docNumError } = await supabase
          .rpc('next_document_number', {
            p_organization_id: organizationId,
            p_document_type: 'order',
          });

        if (docNumError || !docNumber || docNumber.length === 0) {
          throw new Error('Error generando número de pedido: ' + (docNumError?.message || 'sin resultado'));
        }

        orderNumber = docNumber[0].document_number;

        const { data: existing } = await supabase
          .from('sales_orders')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('order_number', orderNumber)
          .maybeSingle();

        if (!existing) break;

        console.warn(`⚠️ Order number ${orderNumber} already exists, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
        if (attempt === MAX_RETRIES - 1) {
          throw new Error(`No se pudo generar un número de pedido único después de ${MAX_RETRIES} intentos.`);
        }
      }
    }

    // Calculate subtotal from items
    let subtotal = 0;
    for (const item of items) {
      const { finalPrice } = resolveItemQuantityAndPrice(item, itemQuantities);
      subtotal += finalPrice;
    }

    // Calculate additionals (only for non-split mode)
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

    // Create sales order
    const { data: salesOrder, error: orderError } = await supabase
      .from('sales_orders')
      .insert({
        order_number: orderNumber!,
        quote_id: quote.id,
        customer_id: quote.customer_id,
        user_id: quote.user_id,
        organization_id: quote.organization_id,
        status: 'pending',
        description: items.length === 1 
          ? (items[0].description || items[0].name || items[0].product_name || quote.description)
          : quote.description,
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

    // Copy quote additionals to sales order additionals (only for non-split mode)
    if (quoteAdditionals && quoteAdditionals.length > 0) {
      const orderAdditionalsData = quoteAdditionals.map((qa: any) => ({
        sales_order_id: salesOrder.id,
        additional_id: qa.additional_id,
        name: qa.name,
        type: qa.type,
        value: qa.value,
        is_discount: qa.is_discount,
      }));

      const { error: additionalsError } = await supabase
        .from('sales_order_additionals')
        .insert(orderAdditionalsData);

      if (additionalsError) throw additionalsError;
    }

    // Create sales order items
    const orderItems = items.map((item: any, index: number) => {
      const { finalQuantity, finalPrice: itemPrice, finalMulti } = resolveItemQuantityAndPrice(item, itemQuantities);

      return {
        sales_order_id: salesOrder.id,
        product_id: item.product_id,
        product_name: item.name || item.product_name,
        description: item.description,
        quantity: finalQuantity,
        price: itemPrice,
        outputs: item.outputs,
        prompts: item.prompts,
        multi: finalMulti,
        position: index,
        composite_data: item.composite_data || null,
        item_additionals: item.item_additionals || null,
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
        .eq('quote_id', quote.id) as any);

      if (quoteAttachments && quoteAttachments.length > 0) {
        const orderAttachments = quoteAttachments.map((att: any) => ({
          organization_id: att.organization_id,
          sales_order_id: salesOrder.id,
          file_name: att.file_name,
          file_path: att.file_path,
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

    return salesOrder;
  };

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

      // Check if this quote already has a sales order (prevent duplicate approvals)
      const { data: existingOrder } = await supabase
        .from('sales_orders')
        .select('id, order_number')
        .eq('quote_id', quoteId)
        .maybeSingle();

      if (existingOrder) {
        throw new Error(`Este presupuesto ya tiene un pedido asociado (${existingOrder.order_number}). No se puede aprobar de nuevo.`);
      }

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

      const organizationId = quote.organization_id || sessionStorage.getItem('selected_organization_id');
      if (!organizationId) {
        throw new Error('No se pudo determinar la organización');
      }

      // Check if this organization uses split orders per item
      const { data: orgConfig } = await supabase
        .from('organizations')
        .select('split_orders_per_item')
        .eq('id', organizationId)
        .single();

      const splitOrdersPerItem = orgConfig?.split_orders_per_item === true;

      // Fetch quote additionals (only used in non-split mode)
      const { data: quoteAdditionals } = await supabase
        .from('quote_additionals')
        .select('*')
        .eq('quote_id', quoteId);

      let createdOrders: any[] = [];

      if (splitOrdersPerItem) {
        // === SPLIT MODE: one order per item ===
        console.log(`📦 Split mode: creating ${itemsToApprove.length} separate orders`);
        
        for (const item of itemsToApprove) {
          // Each item gets its own order WITHOUT quote-level additionals
          // Item-level additionals (item_additionals JSONB) are copied with the item
          const salesOrder = await createSalesOrderForItems(
            quote,
            [item],
            itemQuantities,
            organizationId,
            null, // No quote-level additionals in split mode
          );
          createdOrders.push(salesOrder);
          console.log(`✅ Created order ${salesOrder.order_number} for item: ${item.name || item.product_name}`);
        }
      } else {
        // === NORMAL MODE: one order with all items ===
        const salesOrder = await createSalesOrderForItems(
          quote,
          itemsToApprove,
          itemQuantities,
          organizationId,
          quoteAdditionals,
        );
        createdOrders.push(salesOrder);
      }

      // Mark approved items as accepted and non-approved items as not accepted
      const allItemIds = quote.items.map((item: any) => item.id);
      const approvedIds = itemsToApprove.map((item: any) => item.id);
      const nonApprovedIds = allItemIds.filter((id: string) => !approvedIds.includes(id));

      if (approvedIds.length > 0) {
        await supabase
          .from('quote_items')
          .update({ accepted: true })
          .in('id', approvedIds);
      }

      if (nonApprovedIds.length > 0) {
        await supabase
          .from('quote_items')
          .update({ accepted: false })
          .in('id', nonApprovedIds);
      }

      // Update multi-quantity items with the selected quantity
      for (const item of itemsToApprove) {
        const multi = item.multi as any;
        if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1 && itemQuantities?.[item.id]) {
          await supabase
            .from('quote_items')
            .update({ accepted_quantity: itemQuantities[item.id] })
            .eq('id', item.id);
        }
      }

      // Update quote status AND recalculate totals based on approved items only
      let approvedSubtotal = 0;
      for (const item of itemsToApprove) {
        const { finalPrice } = resolveItemQuantityAndPrice(item, itemQuantities);
        approvedSubtotal += finalPrice;
      }
      
      // Calculate additionals for quote totals
      let discountAmount = 0;
      let taxAmount = 0;
      if (quoteAdditionals && quoteAdditionals.length > 0) {
        for (const additional of quoteAdditionals) {
          if (additional.is_discount) {
            if (additional.type === 'percentage') {
              discountAmount += (approvedSubtotal * additional.value) / 100;
            } else {
              discountAmount += additional.value;
            }
          } else {
            if (additional.type === 'percentage') {
              taxAmount += (approvedSubtotal * additional.value) / 100;
            } else {
              taxAmount += additional.value;
            }
          }
        }
      }
      const quoteFinalPrice = approvedSubtotal - discountAmount + taxAmount;

      const { error: updateQuoteError } = await supabase
        .from('quotes')
        .update({ 
          status: 'approved',
          subtotal: approvedSubtotal,
          final_price: quoteFinalPrice,
        })
        .eq('id', quoteId);

      if (updateQuoteError) {
        console.error('Error updating quote status, but orders were created:', updateQuoteError);
      }

      // Export quote (estimate) to Holded with only approved items
      if (canExportQuotesOnApproval) {
        try {
          const approvedItemIds = itemsToApprove.map((item: any) => item.id);
          console.log('🚀 Exporting estimate to Holded:', quoteId, 'with approved items:', approvedItemIds);
          const { error: estimateError } = await supabase.functions.invoke('holded-export-estimate', {
            body: { quoteId, approvedItemIds }
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

      // Export orders to Holded if integration is active
      if (canExportOrders) {
        let allExportsOk = true;
        for (const order of createdOrders) {
          try {
            console.log('🚀 Exporting order to Holded:', order.id, order.order_number);
            const { error: holdedError } = await supabase.functions.invoke('holded-export-order', {
              body: { orderId: order.id }
            });

            if (holdedError) {
              console.error('❌ Error exporting order to Holded:', order.order_number, holdedError);
              allExportsOk = false;
            } else {
              console.log('✅ Successfully exported order to Holded:', order.order_number);
            }
          } catch (holdedError) {
            console.error('Error exporting to Holded:', holdedError);
            allExportsOk = false;
          }
        }

        if (splitOrdersPerItem) {
          const orderNumbers = createdOrders.map(o => o.order_number).join(', ');
          if (allExportsOk) {
            toast({
              title: "Presupuesto aprobado y exportado",
              description: `${createdOrders.length} pedidos creados: ${orderNumbers} (exportados a Holded)`,
            });
          } else {
            toast({
              title: "Presupuesto aprobado",
              description: `${createdOrders.length} pedidos creados: ${orderNumbers} (algunos no se exportaron a Holded)`,
              variant: "default",
            });
          }
        } else {
          const orderNumber = createdOrders[0]?.order_number;
          if (allExportsOk) {
            toast({
              title: "Presupuesto aprobado y exportado",
              description: `Presupuesto ${quote.quote_number} → Pedido ${orderNumber} (exportado a Holded)`,
            });
          } else {
            toast({
              title: "Presupuesto aprobado",
              description: `Pedido ${orderNumber} creado, pero hubo un error al exportar a Holded`,
              variant: "default",
            });
          }
        }
      } else {
        if (splitOrdersPerItem) {
          const orderNumbers = createdOrders.map(o => o.order_number).join(', ');
          toast({
            title: "Presupuesto aprobado",
            description: `${createdOrders.length} pedidos creados: ${orderNumbers}`,
          });
        } else {
          toast({
            title: "Presupuesto aprobado",
            description: `Presupuesto ${quote.quote_number} → Pedido ${createdOrders[0]?.order_number}`,
          });
        }
      }

      // Return first order for backward compatibility
      return createdOrders[0];
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
