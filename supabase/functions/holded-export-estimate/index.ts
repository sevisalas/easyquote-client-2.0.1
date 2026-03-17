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

    const { quoteId, approvedItemIds } = await req.json();
    console.log('Exporting quote to Holded:', quoteId, 'approvedItemIds:', approvedItemIds);

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

    // Filter by approved items if specified (when called from approval flow)
    let filteredItems = quoteItems || [];
    if (Array.isArray(approvedItemIds) && approvedItemIds.length > 0) {
      filteredItems = filteredItems.filter((item: any) => approvedItemIds.includes(item.id));
      console.log(`📋 Filtered to ${filteredItems.length} approved items out of ${quoteItems?.length || 0} total`);
    }

    // Get quote additionals from the quote's JSON field (not from separate table)
    const quoteAdditionals = quote.quote_additionals || [];

    console.log('📦 Quote items (filtered):', JSON.stringify(filteredItems, null, 2));
    console.log('📦 Quote additionals from quote JSON:', JSON.stringify(quoteAdditionals, null, 2));

    // Get customer Holded data if customer_id exists
    let contactId: string | null = null;
    let contactData: any = null;
    
    if (quote.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('holded_id, name, email, phone, address, organization_id')
        .eq('id', quote.customer_id)
        .maybeSingle();
      
      if (customer) {
        // Safety guard: customer must belong to the same organization as the quote
        if (quote.organization_id && customer.organization_id && customer.organization_id !== quote.organization_id) {
          throw new Error('El cliente seleccionado no pertenece a la organización del presupuesto');
        }

        contactData = customer;
        if (customer.holded_id) {
          contactId = customer.holded_id;
        }
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
      .select('api_user_id, hide_all_prompts_in_documents')
      .eq('id', organizationId)
      .single();
    
    const apiUserId = orgData?.api_user_id;
    const hideAllPromptsInDocs = orgData?.hide_all_prompts_in_documents === true;
    console.log('🙈 hideAllPromptsInDocs:', hideAllPromptsInDocs);

    // Check if org uses template 7/8 (Campillo/Anebri) → skip adjustments in Holded
    const { data: pdfConfig } = await supabase
      .from('pdf_configurations')
      .select('selected_template')
      .eq('organization_id', organizationId)
      .maybeSingle();
    // Item adjustments: always bake into item price (hidden in Holded)
    // Quote adjustments: always show as separate line items in Holded
    const hideItemAdjustmentsInHolded = pdfConfig?.selected_template === 7 || pdfConfig?.selected_template === 8;
    const hideAdjustmentsInHolded = false; // Quote-level adjustments always visible
    console.log('🔧 hideAdjustmentsInHolded:', hideAdjustmentsInHolded, 'template:', pdfConfig?.selected_template);
    
    // Get hidden prompt settings: hide_in_documents OR admin_only (if user can't see it, client shouldn't either)
    const { data: hiddenPromptSettings } = await supabase
      .from('product_prompt_settings')
      .select('easyquote_product_id, prompt_name, label')
      .eq('api_user_id', apiUserId)
      .or('hide_in_documents.eq.true,admin_only.eq.true');

    // Load quantity prompt settings (is_quantity = true)
    const { data: quantityPromptSettings } = await supabase
      .from('product_prompt_settings')
      .select('easyquote_product_id, prompt_name, label')
      .eq('api_user_id', apiUserId)
      .eq('is_quantity', true);

    // Build a map: productId -> { prompt_name, label } for quantity prompts
    const quantityPromptByProduct = new Map<string, { prompt_name: string; label: string | null }>();
    (quantityPromptSettings || []).forEach((s: any) => {
      quantityPromptByProduct.set(s.easyquote_product_id, { prompt_name: s.prompt_name, label: s.label });
    });
    console.log('📊 Quantity prompts configured:', Object.fromEntries(quantityPromptByProduct));

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
      // Only add label to set if it's a real human label (not just a copy of prompt_name)
      if (s.label && s.label !== s.prompt_name) {
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
        
        // Call BOTH APIs in parallel:
        // 1. prompts/list → returns {id: UUID, promptCell: cellRef} (no human labels)
        // 2. pricing GET → returns {id: UUID, promptText: humanLabel} (has human labels)
        const [promptsRes, pricingRes] = await Promise.all([
          fetch(
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
          ),
          fetch(
            `https://api.easyquote.cloud/api/v1/products/pricing/${productId}?${cacheBuster}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${easyquoteToken}`,
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
            },
          ),
        ]);

        if (!promptsRes.ok) {
          const text = await promptsRes.text();
          console.warn('[Holded export] No se pudieron cargar prompts de EasyQuote', { productId, status: promptsRes.status, textPreview: text.slice(0, 200) });
          return null;
        }

        const promptsData = await promptsRes.json();
        if (!Array.isArray(promptsData)) return null;

        // Build UUID → promptText map from pricing API
        const uuidToHumanLabel = new Map<string, string>();
        if (pricingRes.ok) {
          try {
            const pricingData = await pricingRes.json();
            const pricingPrompts = pricingData?.prompts || (Array.isArray(pricingData) ? pricingData : []);
            for (const p of pricingPrompts) {
              if (p?.id && p?.promptText) {
                uuidToHumanLabel.set(String(p.id).trim(), String(p.promptText).trim());
              }
            }
          } catch (e) {
            console.warn('[Holded export] Could not parse pricing response', e);
          }
        }

        const map: Record<string, PromptDef> = {};
        for (const raw of promptsData) {
          // Enrich with human label from pricing API before normalizing
          const uuid = String(raw?.id ?? '').trim();
          if (uuid && uuidToHumanLabel.has(uuid) && !raw.promptText) {
            raw.promptText = uuidToHumanLabel.get(uuid);
          }
          const def = normalizeEasyQuotePromptDef(raw);
          if (!def) continue;
          for (const kk of keyVariants(def.id)) map[kk] = def;
          if (def.label) {
            for (const kk of keyVariants(def.label)) map[kk] = def;
          }
          // Also index by promptCell so backfill can find by cell ref
          if (raw.promptCell) {
            for (const kk of keyVariants(raw.promptCell)) map[kk] = def;
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
        (filteredItems || [])
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
      // Skip if label is already a real human label (not just a copy of prompt_name)
      if (s.label && s.label !== s.prompt_name) continue;
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
    // parentPromptsArray: prompts del item padre (nivel general del producto compuesto) para evitar repetirlos en los componentes
    const buildCompositeDescription = (compositeData: any, parentPromptsArray?: any[]): string => {
      if (!compositeData || typeof compositeData !== 'object') return '';
      const componentsMap = compositeData.components || {};
      const activeComponents = compositeData.activeComponents || [];

      // Build a set of "label:value" pairs from the parent prompts so we can skip them in components
      const parentPromptSignatures = new Set<string>();
      if (Array.isArray(parentPromptsArray)) {
        for (const p of parentPromptsArray) {
          const label = normalizePromptKey(p?.label ?? p?.promptText ?? p?.id ?? '');
          const val = String(p?.value ?? p?.currentValue ?? '').trim();
          if (label) parentPromptSignatures.add(`${label}:${val}`);
        }
      }

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
            if (hidden) return false;
            // Skip prompts that are already shown in the parent (propagated/general fields)
            if (parentPromptSignatures.size > 0) {
              const label = normalizePromptKey(p?.promptText ?? p?.label ?? p?.id ?? '');
              const valStr = String(val).trim();
              if (parentPromptSignatures.has(`${label}:${valStr}`)) return false;
            }
            return true;
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
    
    filteredItems.forEach((item: any) => {
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
        let parentPromptsArray: any[] = [];

        // If org-level flag hides all prompts, use item.description directly
        if (hideAllPromptsInDocs) {
          baseDescription = item.description || '';
        } else {
          if (item.prompts) {
            // Handle both array and object formats
            if (Array.isArray(item.prompts)) {
              parentPromptsArray = item.prompts;
            } else if (typeof item.prompts === 'object') {
              parentPromptsArray = Object.entries(item.prompts).map(([key, value]) => ({
                id: key,
                ...(typeof value === 'object' ? value : { value })
              }));
            }

            // Convert to object for visibility checking (add id + label keys for robust matching)
            const promptsObj = parentPromptsArray.reduce((acc: any, p: any) => {
              const keys = [p?.id, p?.name, p?.key, p?.label].filter(Boolean);
              for (const k of keys) {
                const sk = String(k);
                if (!(sk in acc)) acc[sk] = p;
              }
              return acc;
            }, {});

            const valuesMap = enrichValuesMapWithDefs(defsMap, parentPromptsArray, buildValuesMap(promptsObj));

            // Find the quantity prompt label
            const qtyPromptData = parentPromptsArray.find(p => p.id === item.multi.qtyPrompt);
            if (qtyPromptData?.label) {
              qtyPromptLabel = qtyPromptData.label;
            }

            if (parentPromptsArray.length > 0) {
              baseDescription = parentPromptsArray
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
        } // end else (not hideAllPromptsInDocs)

        // Item additionals are now exported as separate line items (not in description)

        // Append composite component details (pass parent prompts to avoid repeating propagated fields)
        if (!hideAllPromptsInDocs) {
          const compositeDesc = buildCompositeDescription(item.composite_data, parentPromptsArray);
          if (compositeDesc) {
            baseDescription += (baseDescription ? '\n\n' : '') + compositeDesc;
          }
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
          
          // Item additionals are now separate line items - don't apply to row price
          
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
        } else if (hideAllPromptsInDocs) {
          // Org-level flag: use item.description directly, skip all prompts
          description = item.description || '';
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
        
        // Item additionals text is handled later in the item_additionals processing block

        // Append composite component details (only when prompts are NOT hidden)
        if (!hideAllPromptsInDocs) {
          let singlePromptsArray: any[] = [];
          if (item.prompts && !isCustomProduct) {
            if (Array.isArray(item.prompts)) {
              singlePromptsArray = item.prompts;
            } else if (typeof item.prompts === 'object') {
              singlePromptsArray = Object.entries(item.prompts).map(([key, value]) => ({
                id: key,
                ...(typeof value === 'object' ? value : { value })
              }));
            }
          }
          const compositeDescSingle = buildCompositeDescription(item.composite_data, singlePromptsArray);
          if (compositeDescSingle) {
            description += (description ? '\n\n' : '') + compositeDescSingle;
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
            
            // Fallback: if output Price is 0 but item.price has a real value, use item.price
            // This happens with composite products where the price is stored directly on the item
            if (totalPrice === 0 && parseFloat(item.price) > 0) {
              totalPrice = parseFloat(item.price);
              console.log('💰 Output Price was 0, using item.price fallback:', totalPrice);
            }
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
        
        // Detect quantity from prompts ONLY (never from outputs)
        // Priority: 1) prompt marked with is_quantity in product_prompt_settings
        //           2) heuristic fallback on prompt labels
        //           3) custom product quantity
        if (!isCustomProduct && item.prompts) {
          const promptsArray = Array.isArray(item.prompts) ? item.prompts : [];
          const qtySetting = quantityPromptByProduct.get(itemProductId);
          
          if (qtySetting) {
            // Use the prompt marked as is_quantity in settings
            const normalizedSettingName = normalizePromptKey(qtySetting.prompt_name).toUpperCase();
            const normalizedSettingLabel = qtySetting.label ? normalizePromptKey(qtySetting.label).toUpperCase() : null;
            
            // Also resolve cell ref (e.g. 'B6') → human label via defsMap for matching against stored prompts
            let resolvedLabel: string | null = null;
            if (defsMap) {
              for (const kk of keyVariants(qtySetting.prompt_name)) {
                const def = (defsMap as any)[kk];
                if (def?.label) {
                  resolvedLabel = normalizePromptKey(def.label).toUpperCase();
                  break;
                }
              }
            }
            
            const qtyPrompt = promptsArray.find((p: any) => {
              const pName = normalizePromptKey(p?.name || p?.id || '').toUpperCase();
              const pLabel = normalizePromptKey(p?.label || '').toUpperCase();
              return pName === normalizedSettingName || pLabel === normalizedSettingName ||
                     (normalizedSettingLabel && (pName === normalizedSettingLabel || pLabel === normalizedSettingLabel)) ||
                     (resolvedLabel && (pName === resolvedLabel || pLabel === resolvedLabel));
            });
            
            if (qtyPrompt) {
              const qtyValue = qtyPrompt.value;
              units = typeof qtyValue === "number" 
                ? qtyValue 
                : parseInt(String(qtyValue || 1).replace(/\./g, "").replace(",", ".")) || 1;
              console.log('📊 Quantity from is_quantity prompt:', { units, promptLabel: qtyPrompt.label, settingName: qtySetting.prompt_name, resolvedLabel });
            }
          }
          
           // Heuristic fallback: if is_quantity is not configured OR configured but unresolved in saved prompts
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
              console.log('📊 Quantity from prompt heuristic (no is_quantity configured):', { units, promptLabel: qtyPrompt.label });
            }
          }
        }
        
        // For custom products, use quantity from prompts
        if (isCustomProduct && units === 1) {
          units = customQuantity;
        }
        
        // Apply item additionals to the price and calculate discounts
        // For Campillo/Anebri (T7/T8): bake into item price (not shown as separate lines)
        // For other templates: also bake into price (item adjustments are always part of the item)
        let discountAmount = 0;
        if (item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
          item.item_additionals.forEach((additional: any) => {
            const value = additional.value || 0;
            const isDiscount = additional.is_discount === true || value < 0;
            
            if (isDiscount) {
              if (additional.name && !appliedDiscounts.includes(additional.name)) {
                appliedDiscounts.push(additional.name);
              }
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
        
        // Item additionals text in description (only when NOT hiding)
        if (!hideItemAdjustmentsInHolded && item.item_additionals && Array.isArray(item.item_additionals) && item.item_additionals.length > 0) {
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
        
        // Calculate unit price from total price and units
        const unitPrice = units > 0 ? totalPrice / units : totalPrice;
        
        // Round to 6 decimals for Holded compatibility (supports up to 6)
        const roundedUnitPrice = Math.round(unitPrice * 1000000) / 1000000;
        discountAmount = Math.round(discountAmount * 1000000) / 1000000;
        
        console.log('💰 Price calculation:', { totalPrice, units, unitPrice: roundedUnitPrice, productName: item.product_name });
        
        // All products use units + subtotal (unit price)
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
            price = Math.round((subtotal * value / 100) * 100) / 100;
          } else if (additional.type === 'quantity_multiplier' || additional.type === 'multiplier') {
            price = Math.round((subtotal * (value - 1)) * 100) / 100;
          } else {
            price = Math.round(parseFloat(String(value)) * 100) / 100;
          }
          
          if (hideAdjustmentsInHolded) {
            // When hiding: distribute the additional amount proportionally across existing items
            if (price !== 0 && items.length > 0) {
              const currentSubtotal = items.reduce((sum, item) => sum + (item.subtotal * item.units), 0);
              if (currentSubtotal > 0) {
                const factor = 1 + (price / currentSubtotal);
                items.forEach(item => {
                  item.subtotal = Math.round(item.subtotal * factor * 1000000) / 1000000;
                });
              }
            }
          } else {
            // When showing: add as separate line item
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
      contactName: contactData?.name || '',
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
    
    // Add contact address/email/phone if available (helps Holded contact auto-creation fallback)
    if (contactData?.address) {
      estimatePayload.contactAddress = contactData.address;
    }

    if (contactData?.email) {
      estimatePayload.contactEmail = contactData.email;
    }

    if (contactData?.phone) {
      estimatePayload.contactPhone = contactData.phone;
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

    // Update quote with Holded estimate ID (do NOT override status - let the caller manage it)
    if (holdedData.id) {
      // Check current quote status to avoid overwriting 'approved' with 'sent'
      const { data: currentQuote } = await supabase
        .from('quotes')
        .select('status')
        .eq('id', quoteId)
        .single();
      
      const updatePayload: any = {
        holded_estimate_id: holdedData.id,
        holded_estimate_number: holdedData.invoiceNum ?? null,
        holded_id: holdedData.id,
      };
      
      // Only set status to 'sent' if the quote is NOT already approved
      if (currentQuote?.status !== 'approved') {
        updatePayload.status = 'sent';
      }
      
      await supabase
        .from('quotes')
        .update(updatePayload)
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
