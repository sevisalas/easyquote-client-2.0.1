import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';
import { isVisiblePromptDef, unwrapPromptValue } from '../_shared/prompt_visibility.ts';

const HOLDED_API_URL = 'https://api.holded.com/api/invoicing/v1/documents/estimate';

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

    const { quoteId } = await req.json();
    console.log('Exporting quote to Holded:', quoteId);

    if (!quoteId) {
      throw new Error('quoteId is required');
    }

    // Get quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quoteError);
      throw new Error('Quote not found');
    }

    // Verify user has access to this quote (either owns it or is in the same organization)
    if (quote.user_id !== user.id) {
      const quoteOrgId = quote.organization_id;
      if (!quoteOrgId) {
        throw new Error('No tienes permiso para exportar este presupuesto');
      }
      // Check if the current user is a member of the quote's organization
      const { data: memberCheck } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', quoteOrgId)
        .maybeSingle();

      // Also check if user is the organization owner
      const { data: ownerCheck } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', quoteOrgId)
        .eq('api_user_id', user.id)
        .maybeSingle();

      if (!memberCheck && !ownerCheck) {
        throw new Error('No tienes permiso para exportar este presupuesto');
      }
    }

    // Get quote items separately
    const { data: quoteItems, error: itemsError } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId);

    if (itemsError) {
      console.error('Error fetching quote items:', itemsError);
      throw new Error('Failed to fetch quote items');
    }

    // Get quote additionals from the quote's JSON field (not from separate table)
    const quoteAdditionals = quote.quote_additionals || [];

    console.log('📦 Quote items fetched:', JSON.stringify(quoteItems, null, 2));
    console.log('📦 Quote additionals from quote JSON:', JSON.stringify(quoteAdditionals, null, 2));

    // Get customer holded_id if customer_id exists
    let contactId: string | null = null;
    
    if (quote.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('holded_id')
        .eq('id', quote.customer_id)
        .maybeSingle();
      
      if (customer?.holded_id) {
        contactId = customer.holded_id;
      }
    }

    if (!contactId) {
      throw new Error('No se encontró contactId de Holded para este cliente');
    }

    // Get the sales account (cuenta_holded) from the quote creator
    let salesChannelId = null;
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('cuenta_holded')
      .eq('user_id', quote.user_id)
      .maybeSingle();
    
    if (memberData?.cuenta_holded) {
      salesChannelId = memberData.cuenta_holded;
      console.log('Using sales account:', salesChannelId);
    }

    // Use organization_id directly from the quote (source of truth)
    const organizationId = quote.organization_id;
    console.log('Using organization from quote:', organizationId);
    
    if (!organizationId) {
      console.error('No organization_id found on quote:', quoteId);
      throw new Error('No se encontró organización para este presupuesto');
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

    // Get EasyQuote credentials to fetch product definitions
    const { data: easyquoteCredsData } = await supabase
      .rpc('get_organization_easyquote_credentials', { p_user_id: user.id });
    
    const easyquoteCreds = easyquoteCredsData?.[0];
    if (!easyquoteCreds) {
      console.warn('No EasyQuote credentials found, will include all prompts with labels');
    }

    // Get EasyQuote token for fetching product definitions
    let easyquoteToken: string | null = null;
    if (easyquoteCreds) {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('easyquote-auth', {
        body: {
          email: easyquoteCreds.api_username,
          password: easyquoteCreds.api_password
        }
      });
      
      if (!tokenError && tokenData?.token) {
        easyquoteToken = tokenData.token;
        console.log('✅ Got EasyQuote token for product definitions');
      } else {
        console.warn('Failed to get EasyQuote token:', tokenError);
      }
    }

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

    // Get api_user_id for the organization (to get shared prompt settings)
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_user_id')
      .eq('id', organizationId)
      .single();
    
    const apiUserId = orgData?.api_user_id;
    
    // Get hidden prompt settings: hide_in_documents OR admin_only (if user can't see it, client shouldn't either)
    const { data: hiddenPromptSettings } = await supabase
      .from('product_prompt_settings')
      .select('easyquote_product_id, prompt_name, label')
      .eq('api_user_id', apiUserId)
      .or('hide_in_documents.eq.true,admin_only.eq.true');

    // IMPORTANT: in product_prompt_settings we store prompt_name (prompt id/name), not the human label.
    // Match using normalized keys to avoid issues with $, casing, spaces, etc.
    const normalizeHiddenKey = (v: unknown) => normalizePromptKey(v).toUpperCase();
    const makeHiddenKey = (productId: unknown, promptKey: unknown) => `${String(productId ?? '')}:${normalizeHiddenKey(promptKey)}`;
    const isHiddenInDocuments = (productId: unknown, prompt: any, defsMap?: Record<string, PromptDef> | null): boolean => {
      const candidates = [prompt?.name, prompt?.id, prompt?.label].filter(Boolean);
      // Also resolve through prompt definitions: label → cell ref (def.id)
      // This bridges the gap between saved prompts (which have labels) and settings (which have cell refs)
      if (defsMap && prompt?.label) {
        const def = getPromptDef(defsMap, prompt);
        if (def?.id) candidates.push(def.id);
      }
      return candidates.some((c) => hiddenPromptsSet.has(makeHiddenKey(productId, c)));
    };
    
    // Create a set of hidden prompts for quick lookup: "productId:PROMPT_KEY"
    // Include BOTH prompt_name (cell ref like B18) AND label (human name like "Forzar recurso")
    const hiddenPromptsSet = new Set<string>();
    (hiddenPromptSettings || []).forEach((s: any) => {
      hiddenPromptsSet.add(makeHiddenKey(s.easyquote_product_id, s.prompt_name));
      if (s.label) {
        hiddenPromptsSet.add(makeHiddenKey(s.easyquote_product_id, s.label));
      }
    });
    console.log('🙈 Hidden prompts set:', Array.from(hiddenPromptsSet));

    // --- Dynamic prompt visibility (EasyQuote) ---
    type PromptDef = {
      id: string;
      label?: string;
      visibility?: unknown;
      hiddenWhen?: unknown;
    };

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

    // Some EasyQuote visibility rules reference prompt IDs/cells (e.g., "$A$", "A", etc.)
    // while our saved quote prompts are keyed by human labels and numeric ids.
    // To correctly evaluate visibility, we map EasyQuote def.id -> the corresponding saved prompt value
    // by matching on (normalized) label.
    const enrichValuesMapWithDefs = (
      defsMap: Record<string, PromptDef> | null | undefined,
      promptsArray: any[],
      valuesMap: Record<string, unknown>,
    ): Record<string, unknown> => {
      if (!defsMap || !Array.isArray(promptsArray) || promptsArray.length === 0) return valuesMap;

      // defsMap stores the same def under many keys; de-duplicate by reference
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

    // Prefetch prompt definitions for all products present in the quote (to evaluate dynamic visibility)
    const productIdsForVisibility = Array.from(
      new Set(
        (quoteItems || [])
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
        if (s.label) continue; // Already has label
        const defs = promptDefsByProductId.get(s.easyquote_product_id);
        if (!defs) continue;
        // Look up the cell ref in defs to find its human label
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


    // ONLY include prompts (user-configured values). Outputs are internal technical data and must NOT be sent to Holded.
    const buildCompositeDescription = (compositeData: any): string => {
      if (!compositeData || typeof compositeData !== 'object') return '';
      const componentsMap = compositeData.components || {};
      const activeComponents = compositeData.activeComponents || [];

      const sortedKeys = Object.keys(componentsMap).sort((a, b) => {
        const orderA = activeComponents.find((ac: any) => a.startsWith(ac.id))?.display_order ?? 99;
        const orderB = activeComponents.find((ac: any) => b.startsWith(ac.id))?.display_order ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
      });

      const sections: string[] = [];
      for (const compKey of sortedKeys) {
        const comp = componentsMap[compKey];
        if (!comp) continue;
        const alias = comp.alias || 'Componente';
        const compPrompts = Array.isArray(comp.prompts) ? comp.prompts : [];

        // Resolve real easyquote_product_id via activeComponents
        const compId = compKey.split(':')[0];
        const activeComp = activeComponents.find((ac: any) => ac.id === compId);
        const compProductId = activeComp?.component_product_id || compId;

        const promptLines = compPrompts
          .filter((p: any) => {
            const val = p?.currentValue ?? p?.value;
            if (val === null || val === undefined || String(val).trim() === '') return false;
            // Filter out hidden/admin-only prompts using the component's real product ID
            const candidates = [p?.promptText, p?.label, p?.id].filter(Boolean);
            const hidden = candidates.some((c) => hiddenPromptsSet.has(makeHiddenKey(compProductId, c)));
            return !hidden;
          })
          .sort((a: any, b: any) => (a.promptSequence || 0) - (b.promptSequence || 0))
          .map((p: any) => `${p.promptText || p.label || p.id || ''}: ${p.currentValue ?? p.value ?? ''}`)
          .filter(Boolean);

        if (promptLines.length > 0) {
          sections.push(`── ${alias} ──\n${promptLines.join('\n')}`);
        }
      }
      return sections.join('\n\n');
    };

    // Build complete payload with all quote data
    const items: any[] = [];
    const appliedDiscounts: string[] = [];
    let hasMultiQuantities = false;
    let globalQtyCounter = 0; // Counter for continuous Q1, Q2, Q3, Q4 numbering
    
    quoteItems.forEach((item: any) => {
      console.log('🔍 Processing item - ALL FIELDS:', JSON.stringify(item, null, 2));

      const itemProductId = String(item.product_id || '');
      const defsMap = itemProductId ? (promptDefsByProductId.get(itemProductId) ?? null) : null;
      
      // Check if item has multiple quantities
      const itemHasMultiQuantities = item.multi && Array.isArray(item.multi.rows) && item.multi.rows.length > 1;
      
      if (itemHasMultiQuantities) {
        hasMultiQuantities = true;
        
        // Build base description from prompts (excluding quantity prompt)
        let baseDescription = '';
        let qtyPromptLabel = 'Cantidad';
        
        if (item.prompts) {
          let promptsArray: any[] = [];
          
          // Handle both array and object formats
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
          
          // Find the quantity prompt label
          const qtyPromptData = promptsArray.find(p => p.id === item.multi.qtyPrompt);
          if (qtyPromptData?.label) {
            qtyPromptLabel = qtyPromptData.label;
          }
          
          if (promptsArray.length > 0) {
            baseDescription = promptsArray
               .filter(prompt => {
                if (!prompt || !prompt.label) return false;
                // Skip the quantity prompt - we'll show it separately
                if (prompt.id === item.multi.qtyPrompt) return false;

                 // Dynamic visibility (based on EasyQuote prompt definitions)
                 const def = getPromptDef(defsMap, prompt);
                 if (def && !isVisiblePromptDef(def, valuesMap)) return false;

                 // Check if this prompt is hidden in documents
                 const productId = item.product_id || '';
                  if (isHiddenInDocuments(productId, prompt, defsMap)) {
                   console.log(`🙈 Hiding prompt "${prompt.label}" (id=${prompt.id ?? 'n/a'}) for product ${productId}`);
                   return false;
                 }
                return true;
              })
              .sort((a, b) => (a.order || 999) - (b.order || 999))
               .map((prompt) => `${prompt.label}: ${formatPromptValue(prompt.value)}`)
              .filter(Boolean)
              .join('\n');
          }
        }
        
        // Add item additionals to description
        if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
          const additionalsText = item.item_additionals
            .map((additional: any) => {
              const value = additional.value || 0;
              const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
              return `${additional.name}: ${formattedValue}€`;
            })
            .join('\n');
          
          if (additionalsText) {
            baseDescription += (baseDescription ? '\n' : '') + additionalsText;
          }
        }

        // Append composite component details
        const compositeDesc = buildCompositeDescription(item.composite_data);
        if (compositeDesc) {
          baseDescription += (baseDescription ? '\n\n' : '') + compositeDesc;
        }
        
        // Create one item per quantity row (each with its own price)
        item.multi.rows.forEach((row: any, index: number) => {
          globalQtyCounter++;
          const qtyValue = row.qty || 0;

          // IMPORTANT: multi rows often store the calculated price inside row.outs (type=Price)
          // and may NOT have row.price populated.
          const outs = (row?.outs ?? row?.outputs ?? []) as any[];
          const priceFromOuts = Array.isArray(outs)
            ? outs.find((o: any) => String(o?.type || '').toLowerCase() === 'price')?.value
            : undefined;
          const rawRowPrice = priceFromOuts ?? row?.price ?? 0;
          let rowPrice = typeof rawRowPrice === "number"
            ? rawRowPrice
            : parseFloat(String(rawRowPrice || 0).replace(/\./g, "").replace(",", ".")) || 0;
          
          // Apply item additionals to the price
          if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
            item.item_additionals.forEach((additional: any) => {
              const value = additional.value || 0;
              const isDiscount = additional.is_discount === true || value < 0;
              
              if (!isDiscount) {
                switch (additional.type) {
                  case 'net_amount':
                    rowPrice += value;
                    break;
                  case 'percentage':
                    rowPrice += (rowPrice * value) / 100;
                    break;
                  case 'quantity_multiplier':
                    rowPrice *= value;
                    break;
                }
              } else {
                // Apply discounts
                switch (additional.type) {
                  case 'net_amount':
                    rowPrice -= Math.abs(value);
                    break;
                  case 'percentage':
                    rowPrice -= Math.abs((rowPrice * value) / 100);
                    break;
                }
              }
            });
          }
          
          // Format quantity for display
          const formattedQty = typeof qtyValue === 'number' 
            ? qtyValue.toLocaleString('es-ES') 
            : qtyValue;
          
          // Add quantity info to description
          const fullDescription = `${qtyPromptLabel}: ${formattedQty}\n${baseDescription}`.trim();
          
          // Create item with quantity label in name and real price
          const itemData: any = {
            name: `${item.product_name || 'Producto'} (Q${globalQtyCounter})`,
            desc: fullDescription,
            units: 1,
            subtotal: rowPrice, // Real price for this quantity
            taxes: ["s_iva_21"]
          };
          
          items.push(itemData);
        });
      } else {
        // Single item without multi quantities
        let description = '';
        
        // Check if this is a custom product
        const isCustomProduct = item.product_id === '__CUSTOM_PRODUCT__';
        let customQuantity = 1;
        let customUnitPrice = 0;
        
        if (isCustomProduct) {
          // For custom products, extract quantity and unit price from prompts by label
          const promptsArray = Array.isArray(item.prompts) ? item.prompts : [];
          const qtyPrompt = promptsArray.find((p: any) => 
            p.label?.toLowerCase().includes('cantidad') || p.id === 'custom_quantity'
          );
          const pricePrompt = promptsArray.find((p: any) => 
            p.label?.toLowerCase().includes('precio') || p.id === 'custom_unit_price'
          );
          
          customQuantity = qtyPrompt?.value || 1;
          customUnitPrice = pricePrompt?.value || 0;
          
          // Use item description directly for custom products
          description = item.description || '';
          
          console.log('📦 Custom product detected:', { customQuantity, customUnitPrice, description, qtyPrompt, pricePrompt });
        } else {
          // Build description from prompts (filter using visibility rules)
          if (item.prompts) {
            let promptsArray: any[] = [];
            
            // Handle both array and object formats
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
                 .filter(prompt => {
                  if (!prompt || !prompt.label) return false;

                    // Dynamic visibility (based on EasyQuote prompt definitions)
                    const def = getPromptDef(defsMap, prompt);
                    if (def && !isVisiblePromptDef(def, valuesMap)) return false;

                   // Check if this prompt is hidden in documents
                   const productId = item.product_id || '';
                   if (isHiddenInDocuments(productId, prompt, defsMap)) {
                     console.log(`🙈 Hiding prompt "${prompt.label}" (id=${prompt.id ?? 'n/a'}) for product ${productId}`);
                     return false;
                   }
                  return true;
                })
                .sort((a, b) => (a.order || 999) - (b.order || 999))
                 .map((prompt) => `${prompt.label}: ${formatPromptValue(prompt.value)}`)
                .filter(Boolean)
                .join('\n');
            }
          }
        }
        
        // OUTPUTS SON DATOS INTERNOS - NO SE ENVÍAN A HOLDED
        
        // Add item additionals (ajustes sobre el artículo) at the end
        if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
          const additionalsText = item.item_additionals
            .map((additional: any) => {
              const value = additional.value || 0;
              const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
              return `${additional.name}: ${formattedValue}€`;
            })
            .join('\n');
          
          if (additionalsText) {
            description += (description ? '\n' : '') + additionalsText;
          }
        }

        // Append composite component details
        const compositeDescSingle = buildCompositeDescription(item.composite_data);
        if (compositeDescSingle) {
          description += (description ? '\n\n' : '') + compositeDescSingle;
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
        
        // Apply item additionals to the price and calculate discounts
        let discountAmount = 0;
        if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
          item.item_additionals.forEach((additional: any) => {
            const value = additional.value || 0;
            // Detect discount: either explicitly marked or has negative value
            const isDiscount = additional.is_discount === true || value < 0;
            
            if (isDiscount) {
              // Add to applied discounts list
              if (additional.name && !appliedDiscounts.includes(additional.name)) {
                appliedDiscounts.push(additional.name);
              }
              // Calculate discount amount
              switch (additional.type) {
                case 'net_amount':
                  discountAmount += Math.abs(value);
                  break;
                case 'percentage':
                  discountAmount += Math.abs((totalPrice * value) / 100);
                  break;
              }
            } else {
              // Apply non-discount adjustments to total price
              switch (additional.type) {
                case 'net_amount':
                  totalPrice += value;
                  break;
                case 'percentage':
                  totalPrice += (totalPrice * value) / 100;
                  break;
                case 'quantity_multiplier':
                  totalPrice *= value;
                  break;
              }
            }
          });
        }
        
        // Calculate unit price from total price and units
        const unitPrice = units > 0 ? totalPrice / units : totalPrice;
        
        // Round to 6 decimals for Holded compatibility (supports up to 6)
        const roundedUnitPrice = Math.round(unitPrice * 1000000) / 1000000;
        discountAmount = Math.round(discountAmount * 1000000) / 1000000;
        
        console.log('💰 Price calculation:', { totalPrice, units, unitPrice: roundedUnitPrice, productName: item.product_name });
        
        // All products use units + subtotal (unit price)
        // For custom products, use 'name' field (display name); for API products use 'product_name'
        const itemName = isCustomProduct 
          ? (item.name || 'Artículo personalizado')
          : (item.name || item.product_name || 'Producto');
        
        const itemData: any = {
          name: itemName,
          desc: description,
          units: units,
          subtotal: roundedUnitPrice,
          taxes: ["s_iva_21"]
        };
        
        // Add discount field if there's a discount
        if (discountAmount > 0) {
          itemData.discount = discountAmount;
        } else if (item.discount_percentage && parseFloat(item.discount_percentage) > 0) {
          itemData.discount = parseFloat(item.discount_percentage);
        }
        
        items.push(itemData);
      }
    });

    // Calculate global discount from quote additionals
    let globalDiscount = 0;
    
    // Add quote additionals (ajustes sobre el presupuesto)
    if (quoteAdditionals && Array.isArray(quoteAdditionals) && quoteAdditionals.length > 0) {
      quoteAdditionals.forEach((additional: any) => {
        const value = additional.value || 0;
        // Detect discount: either explicitly marked or has negative value
        const isDiscount = additional.is_discount === true || value < 0;
        
        if (!isDiscount) {
          // Calculate price based on type
          let price = 0;
          const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
          
          if (additional.type === 'percentage') {
            // For percentage type, calculate the percentage of the current subtotal
            price = Math.round((subtotal * value / 100) * 100) / 100;
          } else if (additional.type === 'quantity_multiplier' || additional.type === 'multiplier') {
            // For multiplier type, calculate the additional amount
            // If multiplier is 1.5, the additional amount is 0.5 * subtotal
            price = Math.round((subtotal * (value - 1)) * 100) / 100;
          } else {
            // For net_amount or default, use the value directly
            price = Math.round(parseFloat(String(value)) * 100) / 100;
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
        } else {
          // Add to applied discounts list
          if (additional.name && !appliedDiscounts.includes(additional.name)) {
            appliedDiscounts.push(additional.name);
          }
          // Calculate global discount
          const subtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
          
          if (additional.type === 'percentage') {
            globalDiscount += (subtotal * Math.abs(value)) / 100;
          } else {
            globalDiscount += Math.abs(value);
          }
        }
      });
    }
    
    globalDiscount = Math.round(globalDiscount * 100) / 100;

    // Add informative discount summary item if there are any discounts
    if (appliedDiscounts.length > 0) {
      items.push({
        name: `DESCUENTOS APLICADOS: ${appliedDiscounts.join(', ')}`,
        desc: '',
        units: 1,
        subtotal: 0,
        taxes: []
      });
    }

    const estimatePayload: any = {
      docType: 'estimate',
      date: Math.floor(new Date(quote.created_at).getTime() / 1000), // Unix timestamp
      contactId: contactId,
      desc: quote.description || 'Pruebas de EasyQuote',
      notes: quote.notes || '',
      items: items,
      paymentMethodId: '5ad06f6a2e1d93408570743e'
    };
    
    // Add sales channel ID if available
    if (salesChannelId) {
      estimatePayload.salesChannelId = salesChannelId;
    }
    
    // Add shipping hidden if any item has multi quantities
    if (hasMultiQuantities) {
      estimatePayload.shipping = 'hidden';
    }
    
    // Add global discount if exists
    if (globalDiscount > 0) {
      estimatePayload.discount = globalDiscount;
    }

    console.log('=== HOLDED EXPORT DEBUG ===');
    console.log('Quote ID:', quoteId);
    console.log('Quote Number:', quote.quote_number);
    console.log('Items count:', items.length);
    console.log('Full payload:', JSON.stringify(estimatePayload, null, 2));
    console.log('API URL:', HOLDED_API_URL);
    console.log('API Key (first 10):', apiKey.substring(0, 10) + '...');
    console.log('=========================');

    // Send to Holded
    const holdedResponse = await fetch(HOLDED_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'key': apiKey
      },
      body: JSON.stringify(estimatePayload)
    });

    const holdedResponseText = await holdedResponse.text();
    console.log('Holded response status:', holdedResponse.status);
    console.log('Holded response:', holdedResponseText);

    if (!holdedResponse.ok) {
      throw new Error(`Holded API error: ${holdedResponse.status} - ${holdedResponseText}`);
    }

    const holdedData = JSON.parse(holdedResponseText);

    // Update quote with Holded estimate ID
    if (holdedData.id) {
      await supabase
        .from('quotes')
        .update({
          // Backwards-compatible fields used by the UI + PDF download
          holded_estimate_id: holdedData.id,
          holded_estimate_number: holdedData.invoiceNum ?? null,

          // New canonical field
          holded_id: holdedData.id,
          status: 'sent'
        })
        .eq('id', quoteId);

      console.log('Quote updated with Holded ID:', holdedData.id);

      // Attach documents if any exist
      try {
        const { data: attachments } = await supabase
          .from('document_attachments')
          .select('id')
          .eq('quote_id', quoteId);

        if (attachments && attachments.length > 0) {
          console.log(`Found ${attachments.length} attachments, sending to Holded...`);
          for (const attachment of attachments) {
            // Download and attach each file
            const { data: attRecord } = await supabase
              .from('document_attachments')
              .select('*')
              .eq('id', attachment.id)
              .single();

            if (attRecord) {
              const { data: fileData } = await supabase.storage
                .from('document-attachments')
                .download(attRecord.file_path);

              if (fileData) {
                const formData = new FormData();
                formData.append('file', fileData, attRecord.file_name);

                const attachResponse = await fetch(
                  `https://api.holded.com/api/invoicing/v1/documents/estimate/${holdedData.id}/attach`,
                  {
                    method: 'POST',
                    headers: { 'key': apiKey, 'accept': 'application/json' },
                    body: formData,
                  }
                );
                console.log(`Attach ${attRecord.file_name}: ${attachResponse.status}`);
              }
            }
          }
        }
      } catch (attachErr) {
        console.error('Error attaching documents (non-fatal):', attachErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        estimateId: holdedData.id,
        estimateNumber: holdedData.invoiceNum,
        message: 'Estimate exported to Holded successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in holded-export-estimate:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to export estimate to Holded'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
