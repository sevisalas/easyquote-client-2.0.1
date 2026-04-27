import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';
import { isVisiblePromptDef, unwrapPromptValue } from '../_shared/prompt_visibility.ts';

const HOLDED_API_URL = 'https://api.holded.com/api/invoicing/v1/documents/salesorder';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { orderId } = await req.json();
    console.log('Updating sales order in Holded:', orderId);

    if (!orderId) {
      throw new Error('orderId is required');
    }

    // Get sales order
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      throw new Error('Order not found');
    }

    // Must have a holded_document_id to update
    if (!order.holded_document_id) {
      throw new Error('Este pedido no ha sido exportado a Holded todavía. Usa la exportación inicial.');
    }

    // Verify user is ADMIN in the organization (not gestor)
    const orderOrgId = order.organization_id;
    if (!orderOrgId) {
      throw new Error('No se encontró organización para este pedido');
    }

    // Check org owner
    const { data: ownedOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orderOrgId)
      .eq('api_user_id', user.id)
      .maybeSingle();

    let isAdmin = !!ownedOrg;

    if (!isAdmin) {
      // Check if user is admin member
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orderOrgId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        throw new Error('No tienes acceso a este pedido');
      }

      if (membership.role !== 'admin') {
        throw new Error('Solo los administradores pueden actualizar pedidos en Holded');
      }
      isAdmin = true;
    }

    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', orderId)
      .order('position');

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      throw new Error('Failed to fetch order items');
    }

    // Get order additionals
    const { data: orderAdditionals } = await supabase
      .from('sales_order_additionals')
      .select('*')
      .eq('sales_order_id', orderId);

    // Get Holded contact ID
    let contactId = null;
    let contactData: any = null;
    
    if (order.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', order.customer_id)
        .single();
      
      if (customer?.holded_id) {
        contactId = customer.holded_id;
        contactData = customer;
      }
    }

    if (!contactId) {
      throw new Error('No se encontró contactId de Holded para este cliente.');
    }

    // Get sales channel
    let salesChannelId = null;
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('cuenta_holded')
      .eq('user_id', order.user_id)
      .maybeSingle();
    
    if (memberData?.cuenta_holded) {
      salesChannelId = memberData.cuenta_holded;
    }

    // Get Holded integration & API key
    const { data: holdedIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .maybeSingle();
    
    if (!holdedIntegration) {
      throw new Error('Integración de Holded no encontrada');
    }
    
    const { data: integrationAccess } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', orderOrgId)
      .eq('integration_id', holdedIntegration.id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!integrationAccess?.access_token_encrypted) {
      throw new Error('API Key de Holded no configurada para esta organización');
    }
    
    const { data: decryptedKey, error: decryptError } = await supabase
      .rpc('decrypt_credential', { encrypted_data: integrationAccess.access_token_encrypted });
    
    if (decryptError || !decryptedKey) {
      throw new Error('Error al descifrar la API Key de Holded');
    }
    
    const apiKey = decryptedKey;

    // Helper functions (same as export)
    const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizePromptKey = (v: unknown) =>
      stripDiacritics(String(v ?? '')).replace(/\$/g, '').replace(/\s+/g, ' ').trim();
    const keyVariants = (v: unknown): string[] => {
      const raw = String(v ?? '').replace(/\s+/g, ' ').trim();
      const rawNoDollar = raw.replace(/\$/g, '').trim();
      const base = normalizePromptKey(v);
      const variants = new Set<string>();
      for (const s of [raw, rawNoDollar, base, stripDiacritics(raw), stripDiacritics(rawNoDollar)]) {
        if (!s) continue;
        variants.add(s);
        variants.add(s.toUpperCase());
        variants.add(s.toLowerCase());
      }
      return Array.from(variants);
    };

    // Get org settings
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_user_id, hide_all_prompts_in_documents')
      .eq('id', orderOrgId)
      .single();
    
    const apiUserId = orgData?.api_user_id;
    const hideAllPromptsInDocs = orgData?.hide_all_prompts_in_documents === true;

    // Hidden prompts
    const { data: hiddenPromptSettings } = await supabase
      .from('product_prompt_settings')
      .select('easyquote_product_id, prompt_name, label')
      .eq('api_user_id', apiUserId)
      .or('hide_in_documents.eq.true,admin_only.eq.true');

    const normalizeHiddenKey = (v: unknown) => normalizePromptKey(v).toUpperCase();
    const makeHiddenKey = (productId: unknown, promptKey: unknown) => `${String(productId ?? '')}:${normalizeHiddenKey(promptKey)}`;
    const hiddenPromptsSet = new Set<string>();
    (hiddenPromptSettings || []).forEach((s: any) => {
      hiddenPromptsSet.add(makeHiddenKey(s.easyquote_product_id, s.prompt_name));
      if (s.label && s.label !== s.prompt_name) {
        hiddenPromptsSet.add(makeHiddenKey(s.easyquote_product_id, s.label));
      }
    });

    const isHiddenInDocuments = (productId: unknown, prompt: any): boolean => {
      const candidates = [prompt?.name, prompt?.id, prompt?.label].filter(Boolean);
      return candidates.some((c) => hiddenPromptsSet.has(makeHiddenKey(productId, c)));
    };

    // Force-include settings
    const { data: forceIncludeSettings } = await supabase
      .from('product_prompt_settings')
      .select('easyquote_product_id, prompt_name, label, force_include_condition')
      .eq('api_user_id', apiUserId)
      .eq('force_include_in_documents', true);

    const forceIncludeMap = new Map<string, string>();
    (forceIncludeSettings || []).forEach((s: any) => {
      const cond = s.force_include_condition || 'always';
      forceIncludeMap.set(makeHiddenKey(s.easyquote_product_id, s.prompt_name), cond);
      if (s.label && s.label !== s.prompt_name) {
        forceIncludeMap.set(makeHiddenKey(s.easyquote_product_id, s.label), cond);
      }
    });

    const evalForceCond = (cond: string, value: unknown): boolean => {
      let v: any = value;
      if (v && typeof v === 'object' && 'value' in v) v = v.value;
      if (cond === 'always') return true;
      const str = String(v ?? '').trim();
      if (cond === 'value_not_empty') return !!str && str.toLowerCase() !== 'no';
      if (cond === 'value_gt_zero') {
        const n = parseFloat(str.replace(/\./g, '').replace(',', '.'));
        if (isNaN(n)) {
          const n2 = parseFloat(str);
          return !isNaN(n2) && n2 > 0;
        }
        return n > 0;
      }
      return true;
    };

    const isForceIncluded = (productId: unknown, prompt: any): boolean => {
      if (forceIncludeMap.size === 0) return false;
      const candidates = [prompt?.name, prompt?.id, prompt?.label, prompt?.promptText].filter(Boolean);
      for (const c of candidates) {
        const cond = forceIncludeMap.get(makeHiddenKey(productId, c));
        if (cond && evalForceCond(cond, prompt?.value ?? prompt?.currentValue)) return true;
      }
      return false;
    };

    // Quantity prompt settings
    const { data: quantityPromptSettings } = await supabase
      .from('product_prompt_settings')
      .select('easyquote_product_id, prompt_name, label')
      .eq('api_user_id', apiUserId)
      .eq('is_quantity', true);

    const quantityPromptByProduct = new Map<string, { prompt_name: string; label: string | null }>();
    (quantityPromptSettings || []).forEach((s: any) => {
      quantityPromptByProduct.set(s.easyquote_product_id, { prompt_name: s.prompt_name, label: s.label });
    });

    const formatPromptValue = (v: any): string => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        if (typeof v.label === 'string' && v.label.trim()) return v.label;
        if (v.value !== undefined && v.value !== null) return String(v.value);
      }
      return String(v);
    };

    // Build items payload (same logic as export)
    const items: any[] = [];
    
    (orderItems || []).forEach((item: any) => {
      const itemProductId = String(item.product_id || '');
      
      let description = '';
      const isCustomProduct = item.product_id === '__CUSTOM_PRODUCT__';
      let customQuantity = 1;
      let customUnitPrice = 0;
      
      if (hideAllPromptsInDocs && !isCustomProduct) {
        description = item.description || '';
      } else if (isCustomProduct) {
        const promptsArray = Array.isArray(item.prompts) ? item.prompts : [];
        const qtyPrompt = promptsArray.find((p: any) => p.id === 'custom_quantity');
        const pricePrompt = promptsArray.find((p: any) => p.id === 'custom_unit_price');
        customQuantity = qtyPrompt?.value ?? item.quantity ?? null;
        customUnitPrice = pricePrompt?.value || 0;
        description = item.description || '';
      } else {
        if (item.prompts) {
          let promptsArray: any[] = [];
          if (Array.isArray(item.prompts)) {
            promptsArray = item.prompts;
          } else if (typeof item.prompts === 'object') {
            promptsArray = Object.entries(item.prompts).map(([key, value]) => ({
              id: key,
              ...(typeof value === 'object' ? value : { value })
            }));
          }
          
          if (promptsArray.length > 0) {
            description = promptsArray
              .filter((prompt) => {
                if (!prompt || !prompt.label) return false;
                const productId = item.product_id || '';
                if (isForceIncluded(productId, prompt)) return true;
                if (isHiddenInDocuments(productId, prompt)) return false;
                const unwrapped = unwrapPromptValue(prompt.value);
                if (unwrapped === null || unwrapped === undefined || String(unwrapped).trim() === '') return false;
                return true;
              })
              .sort((a, b) => (a.order || 999) - (b.order || 999))
              .map((prompt) => {
                if (prompt && 'label' in prompt && 'value' in prompt) {
                  return `${prompt.label}: ${formatPromptValue(prompt.value)}`;
                }
                return '';
              })
              .filter(Boolean)
              .join('\n');
          }
        }
        
        // Composite product components
        if (!hideAllPromptsInDocs && item.composite_data && typeof item.composite_data === 'object') {
          const compositeData = item.composite_data as any;
          const componentsMap = compositeData.components || {};
          const activeComponents = compositeData.activeComponents || [];

          const sortedKeys = Object.keys(componentsMap).sort((a, b) => {
            const orderA = activeComponents.find((ac: any) => a.startsWith(ac.id))?.display_order ?? 99;
            const orderB = activeComponents.find((ac: any) => b.startsWith(ac.id))?.display_order ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.localeCompare(b);
          });

          for (const compKey of sortedKeys) {
            const comp = componentsMap[compKey];
            if (!comp) continue;
            const alias = comp.alias || 'Componente';
            const compPrompts = Array.isArray(comp.prompts) ? comp.prompts : [];
            const compId = compKey.split(':')[0];
            const activeComp = activeComponents.find((ac: any) => ac.id === compId);
            const compProductId = activeComp?.component_product_id || compId;

            const promptLines = compPrompts
              .filter((p: any) => {
                const val = p?.currentValue ?? p?.value;
                const candidates = [p?.promptText, p?.label, p?.id].filter(Boolean);
                if (forceIncludeMap.size > 0) {
                  for (const c of candidates) {
                    const cond = forceIncludeMap.get(makeHiddenKey(compProductId, c));
                    if (cond && evalForceCond(cond, val)) return true;
                  }
                }
                if (val === null || val === undefined || String(val).trim() === '') return false;
                return !candidates.some((c) => hiddenPromptsSet.has(makeHiddenKey(compProductId, c)));
              })
              .sort((a: any, b: any) => (a.promptSequence || 0) - (b.promptSequence || 0))
              .map((p: any) => {
                const label = p.promptText || p.label || p.id || '';
                const value = p.currentValue ?? p.value ?? '';
                return `${label}: ${value}`;
              })
              .filter(Boolean);

            if (promptLines.length > 0) {
              description += (description ? '\n\n' : '') + `── ${alias} ──\n` + promptLines.join('\n');
            }
          }
        }
      }
      
      // Price from outputs
      let totalPrice = 0;
      let units = 1;
      
      if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
        const priceOutput = item.outputs.find((o: any) => 
          String(o?.type || '').toLowerCase() === 'price'
        );
        
        if (priceOutput) {
          const priceValue = priceOutput.value;
          totalPrice = typeof priceValue === "number" 
            ? priceValue 
            : parseFloat(String(priceValue || 0).replace(/\./g, "").replace(",", ".")) || 0;
          
          if (totalPrice === 0 && parseFloat(item.price) > 0) {
            totalPrice = parseFloat(item.price);
          }
        } else {
          totalPrice = parseFloat(item.price) || 0;
        }
      } else {
        totalPrice = parseFloat(item.price) || 0;
      }
      
      // Detect quantity
      if (!isCustomProduct && item.prompts) {
        const promptsArray = Array.isArray(item.prompts) ? item.prompts : [];
        const qtySetting = quantityPromptByProduct.get(itemProductId);
        
        if (qtySetting) {
          const normalizedSettingName = normalizePromptKey(qtySetting.prompt_name).toUpperCase();
          const normalizedSettingLabel = qtySetting.label ? normalizePromptKey(qtySetting.label).toUpperCase() : null;
          
          const qtyPrompt = promptsArray.find((p: any) => {
            const pName = normalizePromptKey(p?.name || p?.id || '').toUpperCase();
            const pLabel = normalizePromptKey(p?.label || '').toUpperCase();
            return pName === normalizedSettingName || pLabel === normalizedSettingName ||
                   (normalizedSettingLabel && (pName === normalizedSettingLabel || pLabel === normalizedSettingLabel));
          });
          
          if (qtyPrompt) {
            const qtyValue = qtyPrompt.value;
            units = typeof qtyValue === "number" 
              ? qtyValue 
              : parseInt(String(qtyValue || 1).replace(/\./g, "").replace(",", ".")) || 1;
          }
        }
        
        // Heuristic fallback
        if (units === 1) {
          const qtyPrompt = promptsArray.find((p: any) => {
            const label = String(p?.label || '').toUpperCase();
            return label.includes('UNIDADES') || label.includes('CANTIDAD') || label.includes('EJEMPLAR') || label.includes('QTY');
          });
          
          if (qtyPrompt) {
            const qtyValue = qtyPrompt.value;
            units = typeof qtyValue === "number" 
              ? qtyValue 
              : parseInt(String(qtyValue || 1).replace(/\./g, "").replace(",", ".")) || 1;
          }
        }
      }
      
      if (isCustomProduct) {
        const cq = typeof customQuantity === 'number'
          ? customQuantity
          : parseFloat(String(customQuantity ?? '').replace(/\./g, '').replace(',', '.'));
        units = Number.isFinite(cq) && cq > 0 ? cq : 0;
      }

      // Validación estricta: si units no se pudo determinar, abortamos con error claro.
      const itemDeclaredQty = parseFloat(String(item.quantity ?? '').replace(/\./g, '').replace(',', '.'));
      const quantityResolved = isCustomProduct
        ? units > 0
        : units > 1 || (Number.isFinite(itemDeclaredQty) && itemDeclaredQty > 0);
      if (!quantityResolved) {
        const productName = item.product_name || 'artículo sin nombre';
        throw new Error(`No se pudo determinar la cantidad del artículo "${productName}". Revisa el motor de precios del producto y asegúrate de que tiene un campo de cantidad válido.`);
      }
      
      // Apply item additionals
      if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
        item.item_additionals.forEach((additional: any) => {
          const value = additional.value || 0;
          const isDiscount = additional.is_discount === true || value < 0;
          
          if (isDiscount) {
            switch (additional.type) {
              case 'net_amount': totalPrice -= Math.abs(value); break;
              case 'percentage': totalPrice -= Math.abs((totalPrice * value) / 100); break;
            }
          } else {
            switch (additional.type) {
              case 'net_amount': totalPrice += value; break;
              case 'percentage': totalPrice += (totalPrice * value) / 100; break;
              case 'quantity_multiplier': totalPrice += value * units; break;
              case 'capacity_divider': {
                const cap = additional.capacity_value || 1;
                const itemQty = units > 1 ? units : (item.quantity || 1);
                const divUnits = Math.ceil(itemQty / cap);
                totalPrice += value * divUnits;
                break;
              }
            }
          }
        });
      }

      const unitPrice = units > 0 ? totalPrice / units : totalPrice;
      const roundedUnitPrice = Math.round(unitPrice * 1000000) / 1000000;
      
      items.push({
        name: item.product_name || 'Producto',
        desc: description,
        units: units,
        subtotal: roundedUnitPrice,
        taxes: ["s_iva_21"]
      });
    });

    // Add order additionals (same as export)
    if (orderAdditionals && Array.isArray(orderAdditionals) && orderAdditionals.length > 0) {
      orderAdditionals.forEach((additional: any) => {
        const value = additional.value || 0;
        const isDiscount = additional.is_discount === true || value < 0;
        
        if (!isDiscount) {
          let price = 0;
          const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
          
          if (additional.type === 'percentage') {
            price = Math.round((subtotal * value / 100) * 1000000) / 1000000;
          } else if (additional.type === 'quantity_multiplier' || additional.type === 'multiplier') {
            price = Math.round((subtotal * (value - 1)) * 1000000) / 1000000;
          } else {
            price = Math.round(parseFloat(String(value)) * 1000000) / 1000000;
          }
          
          const cleanName = (additional.name || 'Ajuste')
            .replace(/\s*Ajuste sobre el presupuesto\s*/gi, '')
            .replace(/\s*Ajuste sobre el pedido\s*/gi, '')
            .trim() || 'Ajuste';
          
          items.push({
            name: cleanName,
            desc: '',
            units: 1,
            subtotal: price,
            taxes: ["s_iva_21"]
          });
        }
      });
    }

    // Build payload for PUT
    const payload: any = {
      contactId,
      contactName: contactData?.name || '',
      desc: order.description || order.title || '',
      date: Math.floor(new Date(order.order_date).getTime() / 1000),
      items,
    };

    if (contactData?.address) payload.contactAddress = contactData.address;
    if (contactData?.email) payload.contactEmail = contactData.email;
    if (contactData?.phone || contactData?.mobile) payload.contactPhone = contactData.phone || contactData.mobile;
    if (salesChannelId) payload.salesChannelId = salesChannelId;
    if (order.delivery_date) payload.deliveryDate = Math.floor(new Date(order.delivery_date).getTime() / 1000);
    if (order.notes) payload.notes = order.notes;

    console.log('📤 Updating in Holded (PUT):', JSON.stringify(payload, null, 2));

    // PUT to Holded API
    const holdedResponse = await fetch(`${HOLDED_API_URL}/${order.holded_document_id}`, {
      method: 'PUT',
      headers: {
        'Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await holdedResponse.text();
    console.log('Holded raw response:', responseText);

    if (!holdedResponse.ok) {
      console.error('Holded API error:', responseText);
      // Try to extract specific error message
      let errorMsg = `Error de Holded (${holdedResponse.status})`;
      try {
        const errData = JSON.parse(responseText);
        if (errData?.message) errorMsg = errData.message;
        else if (errData?.error) errorMsg = errData.error;
      } catch { /* use generic message */ }
      throw new Error(errorMsg);
    }

    const holdedData = JSON.parse(responseText);
    console.log('✅ Order updated in Holded:', holdedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        holdedId: order.holded_document_id,
        message: 'Pedido actualizado en Holded correctamente'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in holded-update-order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
