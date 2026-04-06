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

      // Generate sales order number using the atomic DB function (prevents duplicates)
      const organizationId = quote.organization_id || sessionStorage.getItem('selected_organization_id');
      
      if (!organizationId) {
        throw new Error('No se pudo determinar la organización');
      }

      // Retry logic for order number generation (handles race conditions)
      let orderNumber: string;
      let nextSequential: number;
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
        nextSequential = docNumber[0].sequential_number;

        // Verify the number doesn't already exist
        const { data: existing } = await supabase
          .from('sales_orders')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('order_number', orderNumber)
          .maybeSingle();

        if (!existing) break; // Number is available

        console.warn(`⚠️ Order number ${orderNumber} already exists, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
        
        if (attempt === MAX_RETRIES - 1) {
          throw new Error(`No se pudo generar un número de pedido único después de ${MAX_RETRIES} intentos. Contacta con soporte.`);
        }
      }
      
      console.log(`📋 Approval order numbering (atomic): number="${orderNumber}", seq=${nextSequential}`);

      // Fetch quote additionals
      const { data: quoteAdditionals } = await supabase
        .from('quote_additionals')
        .select('*')
        .eq('quote_id', quoteId);

      const normalizePromptKey = (value: string) =>
        String(value ?? '').replace(/\$/g, '').trim().toUpperCase();

      const parseQuantity = (value: unknown): number => {
        if (typeof value === 'number') {
          return Number.isFinite(value) && value > 0 ? value : 1;
        }

        const parsed = parseFloat(String(value ?? '').replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      };

      const quantityPromptByProduct = new Map<string, { promptName: string; label: string | null }>();
      const productIds = Array.from(
        new Set(
          itemsToApprove
            .map((item: any) => String(item.product_id ?? '').trim())
            .filter(Boolean)
        )
      );

      if (productIds.length > 0 && organizationId) {
        const { data: quantitySettings, error: quantitySettingsError } = await supabase
          .from('product_prompt_settings')
          .select('easyquote_product_id, prompt_name, label')
          .eq('organization_id', organizationId)
          .eq('is_quantity', true)
          .in('easyquote_product_id', productIds);

        if (quantitySettingsError) {
          console.warn('Error loading quantity prompt settings, using prompt fallback:', quantitySettingsError);
        } else {
          for (const row of quantitySettings || []) {
            if (!quantityPromptByProduct.has(row.easyquote_product_id)) {
              quantityPromptByProduct.set(row.easyquote_product_id, {
                promptName: row.prompt_name,
                label: row.label,
              });
            }
          }
        }
      }

      const findQuantityPromptIndex = (item: any, promptsArray: any[]): number => {
        const qtySetting = item.product_id
          ? quantityPromptByProduct.get(String(item.product_id))
          : undefined;

        if (qtySetting) {
          const normalizedSettingName = normalizePromptKey(qtySetting.promptName);
          const normalizedSettingLabel = qtySetting.label ? normalizePromptKey(qtySetting.label) : '';

          const configuredIndex = promptsArray.findIndex((p: any) => {
            const promptName = normalizePromptKey(p?.name || p?.id || '');
            const promptLabel = normalizePromptKey(p?.label || '');

            return (
              promptName === normalizedSettingName ||
              promptLabel === normalizedSettingName ||
              (normalizedSettingLabel &&
                (promptName === normalizedSettingLabel || promptLabel === normalizedSettingLabel))
            );
          });

          if (configuredIndex >= 0) {
            return configuredIndex;
          }
        }

        return promptsArray.findIndex((p: any) => {
          const text = normalizePromptKey(p?.label || p?.name || p?.id || '');
          return (
            text.includes('CANTIDAD') ||
            text.includes('UNIDADES') ||
            text.includes('EJEMPLAR') ||
            text.includes('QUANTITY') ||
            text === 'QTY'
          );
        });
      };

      const resolveItemQuantityFromPrompts = (item: any): number => {
        const promptsArray = Array.isArray(item.prompts)
          ? item.prompts
          : Object.values(item.prompts || {});

        const qtyPromptIndex = findQuantityPromptIndex(item, promptsArray);
        if (qtyPromptIndex >= 0) {
          const qtyPrompt = promptsArray[qtyPromptIndex];
          if (qtyPrompt?.value !== undefined && qtyPrompt?.value !== null) {
            return parseQuantity(qtyPrompt.value);
          }
        }

        return parseQuantity(item.quantity ?? 1);
      };

      const syncPromptsWithSelectedQuantity = (item: any, quantity: number) => {
        const promptsArray = Array.isArray(item.prompts)
          ? [...item.prompts]
          : Object.values(item.prompts || {});

        const qtyPromptIndex = findQuantityPromptIndex(item, promptsArray);
        if (qtyPromptIndex >= 0) {
          promptsArray[qtyPromptIndex] = {
            ...promptsArray[qtyPromptIndex],
            value: String(quantity),
          };
        }

        return promptsArray;
      };

      const buildAutoDescriptionFromPrompts = (promptsArray: any[]) => {
        const excludeLabels = ['tarifa', 'forzar máquina', 'forzar maquina', 'tira y retira', 'forzar poses', 'forzar poses/pags.', 'modelos'];

        return promptsArray
          .filter((p: any) => {
            const value = String(p?.value ?? '').trim();
            const label = String(p?.label ?? '').toLowerCase().trim();
            if (!value || value.toLowerCase() === 'no') return false;
            if (excludeLabels.some((excluded) => label.includes(excluded))) return false;
            return true;
          })
          .map((p: any) => `${p.label}: ${String(p.value).trim()}`)
          .join('\n');
      };

      // Helper: apply item_additionals to a base price
      const applyItemAdditionals = (basePrice: number, item: any, quantity: number): number => {
        const additionals = item.item_additionals;
        if (!Array.isArray(additionals) || additionals.length === 0) return basePrice;

        // Resolve the quantity tier index for multiValues lookup
        const multi = item.multi as any;
        const qtyInputs: number[] = multi?.qtyInputs || [];
        const qtyIndex = qtyInputs.findIndex((q: number) => Number(q) === Number(quantity));

        let total = basePrice;
        for (const additional of additionals) {
          // For net_amount with multiValues, pick the value for the selected quantity tier
          let value = additional.value || 0;
          if (additional.type === 'net_amount' && Array.isArray(additional.multiValues) && qtyIndex >= 0 && qtyIndex < additional.multiValues.length) {
            value = Number(additional.multiValues[qtyIndex]) || value;
          }

          const isDiscount = additional.is_discount === true || value < 0;
          if (isDiscount) {
            switch (additional.type) {
              case 'net_amount': total -= Math.abs(value); break;
              case 'percentage': total -= Math.abs((total * value) / 100); break;
            }
          } else {
            switch (additional.type) {
              case 'net_amount': total += value; break;
              case 'percentage': total += (total * value) / 100; break;
              case 'quantity_multiplier': total += value * quantity; break;
              case 'capacity_divider': {
                const cap = additional.capacity_value || 1;
                total += value * Math.ceil(quantity / cap);
                break;
              }
            }
          }
        }
        return total;
      };

      // Calculate subtotal from selected items
      let subtotal = 0;
      for (const item of itemsToApprove) {
        const multi = item.multi as any;
        let itemPrice = item.price || 0;

        // If multi with selected quantity, use that specific price
        // and apply item_additionals (since row price is base-only from outputs)
        if (multi?.rows && Array.isArray(multi.rows) && itemQuantities?.[item.id]) {
          const selectedQuantity = itemQuantities[item.id];
          const selectedRow = multi.rows.find((row: any) =>
            Number(row.qty) === selectedQuantity || Number(row.quantity) === selectedQuantity
          );
          if (selectedRow) {
            const basePrice = parseFloat(
              selectedRow.outs?.find((o: any) => o.type === 'Price')?.value ||
                selectedRow.price ||
                item.price ||
                0
            );
            itemPrice = applyItemAdditionals(basePrice, item, selectedQuantity);
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

      // Sequence already updated by next_document_number DB function
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

      // Create sales order items - quantity source of truth is prompts (is_quantity)
      const orderItems = itemsToApprove.map((item: any, index: number) => {
        const multi = item.multi as any;
        // If multi-quantity and user selected a specific quantity, use that; otherwise fall back to prompts
        let finalQuantity = resolveItemQuantityFromPrompts(item);
        if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1 && itemQuantities?.[item.id]) {
          finalQuantity = itemQuantities[item.id];
        }

        let finalPrice = item.price || 0;
        let finalMulti = item.multi;
        let finalOutputs = Array.isArray(item.outputs) ? item.outputs : [];
        let finalPrompts = syncPromptsWithSelectedQuantity(item, finalQuantity);
        const isDescriptionManual = item.description_manual === true;
        let finalDescription = item.description;

        // ONLY modify price if user explicitly selected a quantity from multi options
        if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length > 1 && itemQuantities?.[item.id]) {
          const selectedQuantity = itemQuantities[item.id];
          const selectedRow = multi.rows.find((row: any) =>
            Number(row.qty) === selectedQuantity || Number(row.quantity) === selectedQuantity
          );

          finalPrompts = syncPromptsWithSelectedQuantity(item, selectedQuantity);

          if (selectedRow) {
            const basePrice = parseFloat(
              selectedRow.outs?.find((o: any) => o.type === 'Price')?.value ||
                selectedRow.price ||
                item.price ||
                0
            );
            // Apply item_additionals to the selected row's base price
            finalPrice = applyItemAdditionals(basePrice, item, selectedQuantity);
            finalOutputs = Array.isArray(selectedRow.outs) ? selectedRow.outs : finalOutputs;
            // Keep only the selected row in multi
            finalMulti = {
              ...multi,
              rows: [selectedRow],
            };
          }
        }

        // If there's only one row in multi, keep that row price (with additionals)
        if (multi?.rows && Array.isArray(multi.rows) && multi.rows.length === 1) {
          const singleRow = multi.rows[0];
          const basePrice = parseFloat(
            singleRow.outs?.find((o: any) => o.type === 'Price')?.value ||
              singleRow.price ||
              item.price ||
              0
          );
          const rowQty = Number(singleRow.qty) || Number(singleRow.quantity) || finalQuantity;
          finalPrice = applyItemAdditionals(basePrice, item, rowQty);
          finalOutputs = Array.isArray(singleRow.outs) ? singleRow.outs : finalOutputs;
        }

        if (!isDescriptionManual) {
          finalDescription = buildAutoDescriptionFromPrompts(finalPrompts) || item.description;
        }

        return {
          sales_order_id: salesOrder.id,
          product_id: item.product_id,
          product_name: item.name || item.product_name,
          description: finalDescription,
          description_manual: isDescriptionManual,
          quantity: finalQuantity,
          price: finalPrice,
          outputs: finalOutputs,
          prompts: finalPrompts,
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

      // Mark approved items as accepted and non-approved items as not accepted
      const allItemIds = quote.items.map((item: any) => item.id);
      const approvedIds = itemsToApprove.map((item: any) => item.id);
      const nonApprovedIds = allItemIds.filter((id: string) => !approvedIds.includes(id));

      // Mark approved items
      if (approvedIds.length > 0) {
        const { error: acceptError } = await supabase
          .from('quote_items')
          .update({ accepted: true })
          .in('id', approvedIds);
        
        if (acceptError) {
          console.error('Error marking items as accepted:', acceptError);
        }
      }

      // Mark non-approved items explicitly as not accepted
      if (nonApprovedIds.length > 0) {
        const { error: rejectError } = await supabase
          .from('quote_items')
          .update({ accepted: false })
          .in('id', nonApprovedIds);
        
        if (rejectError) {
          console.error('Error marking items as not accepted:', rejectError);
        }
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
      const { error: updateQuoteError } = await supabase
        .from('quotes')
        .update({ 
          status: 'approved',
          subtotal,
          final_price: finalPrice,
        })
        .eq('id', quoteId);

      if (updateQuoteError) {
        console.error('Error updating quote status, but order was created:', updateQuoteError);
        // Don't throw - the order was created successfully
      }

      // Export quote (estimate) to Holded with only approved items
      if (canExportQuotesOnApproval) {
        try {
          // Send approved item IDs so the edge function only exports those
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
