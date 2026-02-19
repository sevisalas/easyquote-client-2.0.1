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
    console.log('Exporting sales order to Holded:', orderId);

    if (!orderId) {
      throw new Error('orderId is required');
    }

    // Get sales order with quote relation
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*, quotes!sales_orders_quote_id_fkey(holded_estimate_id, holded_estimate_number)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      throw new Error('Order not found');
    }

    // Extract quote data if exists
    const quoteData = order.quotes as { holded_estimate_id: string | null; holded_estimate_number: string | null } | null;

    // Verify user has access to this order
    if (order.user_id !== user.id) {
      // Check if user belongs to the same organization as the order
      const orderOrgId = order.organization_id;
      let hasAccess = false;

      if (orderOrgId) {
        // Check if user is org owner
        const { data: ownedOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('id', orderOrgId)
          .eq('api_user_id', user.id)
          .maybeSingle();

        if (ownedOrg) {
          hasAccess = true;
        } else {
          // Check if user is org member
          const { data: membership } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', orderOrgId)
            .eq('user_id', user.id)
            .maybeSingle();

          hasAccess = !!membership;
        }
      }

      if (!hasAccess) {
        throw new Error('No tienes permiso para exportar este pedido');
      }
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
    const { data: orderAdditionals, error: additionalsError } = await supabase
      .from('sales_order_additionals')
      .select('*')
      .eq('sales_order_id', orderId);

    if (additionalsError) {
      console.error('Error fetching order additionals:', additionalsError);
    }

    console.log('📦 Order items fetched:', JSON.stringify(orderItems, null, 2));
    console.log('📦 Order additionals:', JSON.stringify(orderAdditionals || [], null, 2));

    // Get Holded contact ID and contact data from customers table
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
        console.log('Found customer with holded_id:', contactId, contactData.name);
      }
    }

    if (!contactId) {
      console.error('Order data:', { 
        customer_id: order.customer_id, 
        holded_contact_id: order.holded_contact_id 
      });
      throw new Error('No se encontró contactId de Holded para este cliente. El cliente debe estar sincronizado con Holded.');
    }

    // Get the sales account from the order creator
    let salesChannelId = null;
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('cuenta_holded')
      .eq('user_id', order.user_id)
      .maybeSingle();
    
    if (memberData?.cuenta_holded) {
      salesChannelId = memberData.cuenta_holded;
      console.log('Using sales account:', salesChannelId);
    }

    // Get organization based on order owner (not current user, since user may belong to multiple orgs)
    let organizationId: string | null = null;
    const orderOwnerId = order.user_id;
    
    const { data: ownedOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('api_user_id', orderOwnerId)
      .limit(1)
      .single();
    
    if (ownedOrg) {
      organizationId = ownedOrg.id;
      console.log('Found organization as owner:', organizationId);
    } else {
      const { data: memberOrg } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', orderOwnerId)
        .limit(1)
        .single();
      
      if (memberOrg) {
        organizationId = memberOrg.organization_id;
        console.log('Found organization as member:', organizationId);
      }
    }
    
    if (!organizationId) {
      console.error('No organization found for order owner:', orderOwnerId);
      throw new Error('No se encontró organización para el propietario del pedido');
    }
    
    // Get Holded integration
    const { data: holdedIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .maybeSingle();
    
    if (!holdedIntegration) {
      throw new Error('Integración de Holded no encontrada');
    }
    
    // Get organization's Holded API key
    const { data: integrationAccess } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', organizationId)
      .eq('integration_id', holdedIntegration.id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!integrationAccess?.access_token_encrypted) {
      throw new Error('API Key de Holded no configurada para esta organización');
    }
    
    // Decrypt the API key
    const { data: decryptedKey, error: decryptError } = await supabase
      .rpc('decrypt_credential', { encrypted_data: integrationAccess.access_token_encrypted });
    
    if (decryptError || !decryptedKey) {
      console.error('Error decrypting Holded API key:', decryptError);
      throw new Error('Error al descifrar la API Key de Holded');
    }
    
    const apiKey = decryptedKey;
    console.log('Using Holded API key for organization:', organizationId);

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

    // --- EasyQuote prompt definitions (for dynamic visibility) ---
    const { data: easyquoteCredsData } = await supabase
      .rpc('get_organization_easyquote_credentials', { p_user_id: user.id });

    const easyquoteCreds = easyquoteCredsData?.[0];
    let easyquoteToken: string | null = null;

    if (easyquoteCreds) {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('easyquote-auth', {
        body: {
          email: easyquoteCreds.api_username,
          password: easyquoteCreds.api_password,
        },
      });

      if (!tokenError && tokenData?.token) {
        easyquoteToken = tokenData.token;
        console.log('✅ Got EasyQuote token for product definitions');
      } else {
        console.warn('Failed to get EasyQuote token:', tokenError);
      }
    } else {
      console.warn('No EasyQuote credentials found, dynamic prompt visibility will be skipped');
    }

    // Get api_user_id for the organization (to get shared prompt settings)
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_user_id')
      .eq('id', organizationId)
      .single();
    
    const apiUserId = orgData?.api_user_id;
    
    // Hide prompts: hide_in_documents OR admin_only (if user can't see it, client shouldn't either)
    const { data: hiddenPromptSettings } = await supabase
      .from('product_prompt_settings')
      .select('easyquote_product_id, prompt_name, label')
      .eq('api_user_id', apiUserId)
      .or('hide_in_documents.eq.true,admin_only.eq.true');

    const normalizeHiddenKey = (v: unknown) => normalizePromptKey(v).toUpperCase();
    const makeHiddenKey = (productId: unknown, promptKey: unknown) => `${String(productId ?? '')}:${normalizeHiddenKey(promptKey)}`;
    const hiddenPromptsSet = new Set(
      (hiddenPromptSettings || []).map((s: any) => makeHiddenKey(s.easyquote_product_id, s.prompt_name)),
    );

    const isHiddenInDocuments = (productId: unknown, prompt: any, defsMap?: Record<string, PromptDef> | null): boolean => {
      const candidates = [prompt?.name, prompt?.id, prompt?.label].filter(Boolean);
      // Also resolve through prompt definitions: label → cell ref (def.id)
      if (defsMap && prompt?.label) {
        const def = getPromptDef(defsMap, prompt);
        if (def?.id) candidates.push(def.id);
      }
      return candidates.some((c) => hiddenPromptsSet.has(makeHiddenKey(productId, c)));
    };

    type PromptDef = { id: string; label?: string; visibility?: unknown; hiddenWhen?: unknown };

    const buildValuesMap = (promptsObj: Record<string, any>): Record<string, unknown> => {
      const values: Record<string, unknown> = {};
      const setIfMissing = (k: unknown, raw: unknown) => {
        for (const kk of keyVariants(k)) {
          if (!kk) continue;
          if (!(kk in values)) values[kk] = raw;
        }
      };

      for (const [k, p] of Object.entries(promptsObj || {})) {
        const raw = unwrapPromptValue(p?.value);
        setIfMissing(k, raw);
        if (p?.id) setIfMissing(p.id, raw);
        if (p?.name) setIfMissing(p.name, raw);
        if (p?.key) setIfMissing(p.key, raw);
        if (p?.label) setIfMissing(p.label, raw);
      }
      return values;
    };

    const getPromptDef = (
      defsMap: Record<string, PromptDef> | null | undefined,
      prompt: any,
    ): PromptDef | null => {
      if (!defsMap || !prompt) return null;
      const candidates = [prompt?.id, prompt?.name, prompt?.key, prompt?.label].filter(Boolean);
      for (const c of candidates) {
        for (const kk of keyVariants(c)) {
          const def = (defsMap as any)[kk];
          if (def) return def as PromptDef;
        }
      }
      return null;
    };

    const enrichValuesMapWithDefs = (
      defsMap: Record<string, PromptDef> | null | undefined,
      promptsArray: any[],
      valuesMap: Record<string, unknown>,
    ): Record<string, unknown> => {
      if (!defsMap || !Array.isArray(promptsArray) || promptsArray.length === 0) return valuesMap;

      const uniqueDefs = Array.from(new Set(Object.values(defsMap)));
      for (const def of uniqueDefs) {
        if (!def?.id) continue;
        const defLabel = def.label ?? def.id;
        const matchedPrompt = promptsArray.find((p: any) =>
          normalizePromptKey(p?.label) === normalizePromptKey(defLabel),
        );
        if (!matchedPrompt) continue;

        const raw = unwrapPromptValue(matchedPrompt?.value);
        for (const kk of keyVariants(def.id)) {
          if (!(kk in valuesMap)) valuesMap[kk] = raw;
        }
        if (def.label) {
          for (const kk of keyVariants(def.label)) {
            if (!(kk in valuesMap)) valuesMap[kk] = raw;
          }
        }
      }
      return valuesMap;
    };

    const formatPromptValue = (v: any): string => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        if (typeof v.label === 'string' && v.label.trim()) return v.label;
        if (v.value !== undefined && v.value !== null) return String(v.value);
      }
      return String(v);
    };

    const normalizeEasyQuotePromptDef = (f: any): PromptDef | null => {
      const id = String(f?.id ?? f?.key ?? f?.name ?? f?.promptCell ?? '').trim();
      if (!id) return null;
      const label = f?.promptText ?? f?.label ?? f?.title ?? f?.name ?? f?.promptCell ?? id;
      const visibility = f?.visibleWhen ?? f?.showIf ?? f?.when ?? f?.condition ?? f?.conditions ?? f?.visibility;
      const hiddenWhen = f?.hiddenWhen ?? f?.hideIf;
      return { id, label, visibility, hiddenWhen };
    };

    const fetchPromptDefsMap = async (productId: string): Promise<Record<string, PromptDef> | null> => {
      if (!easyquoteToken || !productId) return null;
      try {
        const cacheBuster = `_t=${Date.now()}`;
        const res = await fetch(
          `https://api.easyquote.cloud/api/v1/products/prompts/list/${productId}?${cacheBuster}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${easyquoteToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          },
        );

        if (!res.ok) {
          const text = await res.text();
          console.warn('[Holded export] No se pudieron cargar prompts de EasyQuote', { productId, status: res.status, textPreview: text.slice(0, 200) });
          return null;
        }

        const data = await res.json();
        if (!Array.isArray(data)) return null;

        const map: Record<string, PromptDef> = {};
        for (const raw of data) {
          const def = normalizeEasyQuotePromptDef(raw);
          if (!def) continue;
          for (const kk of keyVariants(def.id)) map[kk] = def;
          if (def.label) {
            for (const kk of keyVariants(def.label)) map[kk] = def;
          }
        }
        return map;
      } catch (e) {
        console.warn('[Holded export] Error cargando definiciones de prompts', { productId, error: String((e as any)?.message ?? e) });
        return null;
      }
    };

    // Prefetch prompt definitions for all products present in the order
    const productIdsForVisibility = Array.from(
      new Set(
        (orderItems || [])
          .map((i: any) => i?.product_id)
          .filter((id: any) => typeof id === 'string' && id && id !== '__CUSTOM_PRODUCT__'),
      ),
    );

    const promptDefsByProductId = new Map<string, Record<string, PromptDef> | null>();
    await Promise.all(
      productIdsForVisibility.map(async (pid: string) => {
        const defs = await fetchPromptDefsMap(pid);
        promptDefsByProductId.set(pid, defs);
      }),
    );

    // Backfill labels in product_prompt_settings for hidden prompts (so PDF generator can match by label)
    if (hiddenPromptSettings && hiddenPromptSettings.length > 0) {
      const labelsToUpdate: { promptName: string; productId: string; label: string }[] = [];
      for (const s of hiddenPromptSettings as any[]) {
        if (s.label) continue;
        const defs = promptDefsByProductId.get(s.easyquote_product_id);
        if (!defs) continue;
        for (const kk of keyVariants(s.prompt_name)) {
          const def = (defs as any)[kk];
          if (def?.label && def.label !== def.id) {
            labelsToUpdate.push({ promptName: s.prompt_name, productId: s.easyquote_product_id, label: def.label });
            break;
          }
        }
      }
      if (labelsToUpdate.length > 0) {
        console.log(`📝 Backfilling ${labelsToUpdate.length} labels in product_prompt_settings`);
        await Promise.all(labelsToUpdate.map(({ promptName, productId, label }) =>
          supabase.from('product_prompt_settings')
            .update({ label })
            .eq('easyquote_product_id', productId)
            .eq('prompt_name', promptName)
        ));
      }
    }

    // Build complete payload with all order data
    const items: any[] = [];
    
    orderItems.forEach((item: any) => {
      console.log('🔍 Processing item:', JSON.stringify(item, null, 2));

      const itemProductId = String(item.product_id || '');
      const defsMap = itemProductId ? (promptDefsByProductId.get(itemProductId) ?? null) : null;
      
      let description = '';
      
      // Check if this is a custom product
      const isCustomProduct = item.product_id === '__CUSTOM_PRODUCT__';
      let customQuantity = 1;
      let customUnitPrice = 0;
      
      if (isCustomProduct) {
        // For custom products, extract quantity and unit price from prompts
        const promptsArray = Array.isArray(item.prompts) ? item.prompts : [];
        const qtyPrompt = promptsArray.find((p: any) => p.id === 'custom_quantity');
        const pricePrompt = promptsArray.find((p: any) => p.id === 'custom_unit_price');
        
        customQuantity = qtyPrompt?.value || 1;
        customUnitPrice = pricePrompt?.value || 0;
        
        // Use item description directly for custom products
        description = item.description || '';
        
        console.log('📦 Custom product detected:', { customQuantity, customUnitPrice, description });
      } else {
        // Build description from prompts (ONLY VISIBLE ONES)
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
          
          // Convert to object for visibility checking (add id + label keys for robust matching)
          const promptsObj = promptsArray.reduce((acc: any, p: any) => {
            const keys = [p?.id, p?.name, p?.key, p?.label].filter(Boolean);
            for (const k of keys) {
              const sk = String(k);
              if (!(sk in acc)) acc[sk] = p;
            }
            return acc;
          }, {});

           const valuesMap = enrichValuesMapWithDefs(defsMap, promptsArray, buildValuesMap(promptsObj));
          
          if (promptsArray.length > 0) {
            description = promptsArray
              .filter((prompt) => {
                if (!prompt || !prompt.label) return false;

                // Dynamic visibility (EasyQuote)
                const def = getPromptDef(defsMap, prompt);
                if (def && !isVisiblePromptDef(def, valuesMap)) return false;

                // Hide-in-documents
                const productId = item.product_id || '';
                if (isHiddenInDocuments(productId, prompt, defsMap)) return false;

                // Exclude empty values
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
        
        // Add outputs to description (non-price, non-quantity)
        if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
          const outputsText = item.outputs
            .filter((out: any) => {
              const name = String(out.name || '').toLowerCase();
              const type = String(out.type || '').toLowerCase();
              return !type.includes('price') && !name.includes('precio') && !name.includes('price');
            })
            .map((out: any) => `${out.name}: ${out.value}`)
            .join('\n');
          
          if (outputsText) {
            description += (description ? '\n' : '') + outputsText;
          }
        }

        // ── Composite product: append component details ──
        if (item.composite_data && typeof item.composite_data === 'object') {
          const compositeData = item.composite_data as any;
          const componentsMap = compositeData.components || {};
          const activeComponents = compositeData.activeComponents || [];

          // Sort by display_order then instance_index
          const sortedKeys = Object.keys(componentsMap).sort((a, b) => {
            const compA = componentsMap[a];
            const compB = componentsMap[b];
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

            // Build component prompts text (ONLY prompts, outputs are internal data)
            const promptLines = compPrompts
              .filter((p: any) => {
                const val = p?.currentValue ?? p?.value;
                return val !== null && val !== undefined && String(val).trim() !== '';
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

          console.log('📦 Composite data processed, components:', sortedKeys.length);
        }
      }
      
      // Get price ONLY from outputs type "Price" (sin IVA)
      let totalPrice = 0;
      let units = 1;
      
      console.log('🔍 Item outputs:', JSON.stringify(item.outputs, null, 2));
      
      // MUST find Price output (the real calculated price from EasyQuote, sin IVA)
      if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
        const priceOutput = item.outputs.find((o: any) => 
          String(o?.type || '').toLowerCase() === 'price'
        );
        
        if (priceOutput) {
          const priceValue = priceOutput.value;
          totalPrice = typeof priceValue === "number" 
            ? priceValue 
            : parseFloat(String(priceValue || 0).replace(/\./g, "").replace(",", ".")) || 0;
          console.log('💰 Price from output type=Price (sin IVA):', { totalPrice, outputName: priceOutput.name, outputType: priceOutput.type });
        } else {
          console.log('⚠️ No output with type=Price found! Available types:', item.outputs.map((o: any) => ({ type: o.type, name: o.name })));
          // Fallback: use item.price but it might include IVA
          totalPrice = parseFloat(item.price) || 0;
          console.log('⚠️ Using item.price as fallback (may include IVA):', totalPrice);
        }
      } else {
        console.log('⚠️ No outputs available, using item.price fallback');
        totalPrice = parseFloat(item.price) || 0;
      }
      
      // Detect quantity: first from output type Quantity, then from output name, then from prompts
      if (item.outputs && Array.isArray(item.outputs) && item.outputs.length > 0) {
        // 1) Buscar output con type=Quantity
        let quantityOut = item.outputs.find((o: any) => 
          String(o?.type || '').toLowerCase() === 'quantity'
        );
        
        // 2) Si no hay type=Quantity, buscar por nombre que contenga "unidades", "cantidad", "units", "quantity"
        if (!quantityOut) {
          quantityOut = item.outputs.find((o: any) => {
            const name = String(o?.name || '').toLowerCase();
            return name.includes('unidades') || name.includes('cantidad') || 
                   name.includes('units') || name.includes('quantity') ||
                   name.includes('ejemplares') || name.includes('copias');
          });
        }
        
        if (quantityOut) {
          const qtyValue = quantityOut.value;
          units = typeof qtyValue === "number" 
            ? qtyValue 
            : parseInt(String(qtyValue || 1).replace(/\./g, "").replace(",", ".")) || 1;
          console.log('📊 Quantity from output:', { units, outputName: quantityOut.name, outputType: quantityOut.type });
        }
      }
      
      // If no quantity from output, check prompts for UNIDADES/CANTIDAD/EJEMPLAR
      if (units === 1 && item.prompts) {
        const promptsArray = Array.isArray(item.prompts) ? item.prompts : [];
        const qtyPrompt = promptsArray.find((p: any) => {
          const label = String(p?.label || '').toUpperCase();
          return label.includes('UNIDADES') || label.includes('CANTIDAD') || label.includes('EJEMPLAR');
        });
        
        if (qtyPrompt) {
          const qtyValue = qtyPrompt.value;
          units = typeof qtyValue === "number" 
            ? qtyValue 
            : parseInt(String(qtyValue || 1).replace(/\./g, "").replace(",", ".")) || 1;
          console.log('📊 Quantity from prompt:', { units, promptLabel: qtyPrompt.label });
        }
      }
      
      // For custom products, use quantity from prompts if not already found
      if (isCustomProduct && units === 1) {
        units = customQuantity;
      }
      
      // Calculate unit price from total price and units
      const unitPrice = units > 0 ? totalPrice / units : totalPrice;
      // Round to 6 decimals for Holded compatibility (supports up to 6)
      const roundedUnitPrice = Math.round(unitPrice * 1000000) / 1000000;
      
      console.log('💰 Price calculation:', { totalPrice, units, unitPrice: roundedUnitPrice, productName: item.product_name });
      
      // All products use units + subtotal (unit price)
      const itemData: any = {
        name: item.product_name || 'Producto',
        desc: description,
        units: units,
        subtotal: roundedUnitPrice,
        taxes: ["s_iva_21"]
      };
      
      items.push(itemData);
    });

    // Add order additionals
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
          
          // Remove "Ajuste sobre el presupuesto/pedido" from name
          const cleanName = (additional.name || 'Ajuste')
            .replace(/\s*Ajuste sobre el presupuesto\s*/gi, '')
            .replace(/\s*Ajuste sobre el pedido\s*/gi, '')
            .trim() || 'Ajuste';
          
          const itemData: any = {
            name: cleanName,
            desc: '',
            units: 1,
            subtotal: price,
            taxes: ["s_iva_21"]
          };
          
          items.push(itemData);
        }
      });
    }

    // Build the payload for Holded API (POST only accepts basic fields)
    const payload: any = {
      contactId,
      contactName: contactData?.name || '',
      desc: order.description || order.title || '',
      date: Math.floor(new Date(order.order_date).getTime() / 1000),
      items,
    };
    
    if (quoteData?.holded_estimate_id) {
      console.log('📎 Linking to estimate:', quoteData.holded_estimate_id, '(', quoteData.holded_estimate_number, ')');
    }

    // Add contact address information if available
    if (contactData?.address) {
      payload.contactAddress = contactData.address;
    }
    
    // Add contact email if available
    if (contactData?.email) {
      payload.contactEmail = contactData.email;
    }
    
    // Add contact phone if available
    if (contactData?.phone || contactData?.mobile) {
      payload.contactPhone = contactData.phone || contactData.mobile;
    }

    if (salesChannelId) {
      payload.salesChannelId = salesChannelId;
    }

    if (order.delivery_date) {
      payload.deliveryDate = Math.floor(new Date(order.delivery_date).getTime() / 1000);
    }

    if (order.notes) {
      payload.notes = order.notes;
    }

    console.log('📤 Sending to Holded:', JSON.stringify(payload, null, 2));

    // Send to Holded API
    const holdedResponse = await fetch(HOLDED_API_URL, {
      method: 'POST',
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
      throw new Error(`Holded API error: ${responseText}`);
    }

    const holdedData = JSON.parse(responseText);
    console.log('✅ Order exported to Holded:', holdedData);

    // Holded returns an array, get the first element
    const holdedResult = Array.isArray(holdedData) ? holdedData[0] : holdedData;

    // Update order with Holded IDs
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({
        holded_document_id: holdedResult.id,
        holded_document_number: holdedResult.invoiceNum || null,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order with Holded data:', updateError);
    }

    // Note: Holded API PUT does not support updating 'from', 'customFields', 'approvedAt', or 'shipping'
    // These fields are silently ignored despite returning 200. Removed dead code.

    // Attach documents if any exist
    if (holdedResult.id) {
      try {
        const { data: attachments } = await supabase
          .from('document_attachments')
          .select('*')
          .eq('sales_order_id', orderId);

        if (attachments && attachments.length > 0) {
          console.log(`Found ${attachments.length} attachments for order, sending to Holded...`);
          
          // Get Holded API key (already available as apiKey variable in scope)
          for (const attRecord of attachments) {
            try {
              const { data: fileData } = await supabase.storage
                .from('document-attachments')
                .download(attRecord.file_path);

              if (fileData) {
                const formData = new FormData();
                formData.append('file', fileData, attRecord.file_name);

                const attachResponse = await fetch(
                  `https://api.holded.com/api/invoicing/v1/documents/salesorder/${holdedResult.id}/attach`,
                  {
                    method: 'POST',
                    headers: { 'key': apiKey, 'accept': 'application/json' },
                    body: formData,
                  }
                );
                console.log(`Attach ${attRecord.file_name}: ${attachResponse.status}`);
              }
            } catch (fileErr) {
              console.error(`Error attaching ${attRecord.file_name}:`, fileErr);
            }
          }
        }
      } catch (attachErr) {
        console.error('Error attaching documents to order (non-fatal):', attachErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        holdedId: holdedResult.id,
        holdedNumber: holdedResult.invoiceNum 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in holded-export-order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
