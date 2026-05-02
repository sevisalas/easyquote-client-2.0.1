import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-organization-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Selection {
  source_quote_id: string;
  source_item_id: string;
}

interface Payload {
  customer_id: string;
  organization_id: string;
  selections: Selection[];
  notes?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Auth client (validates JWT)
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'Invalid token' }, 401);
    const userId = userData.user.id;

    // Service client for trusted writes
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = (await req.json()) as Payload;
    const { customer_id, organization_id, selections, notes } = body || ({} as Payload);

    if (!customer_id || !organization_id || !Array.isArray(selections) || selections.length === 0) {
      return json({ error: 'customer_id, organization_id y selections son obligatorios' }, 400);
    }

    // Authorize: caller must belong to the organization
    const { data: membership } = await db
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organization_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) return json({ error: 'Acceso denegado a la organización' }, 403);

    // Fetch and validate source items
    const itemIds = selections.map((s) => s.source_item_id);
    const { data: srcItems, error: itemsErr } = await db
      .from('quote_items')
      .select('*, quotes!inner(id, organization_id, quote_number)')
      .in('id', itemIds);

    if (itemsErr) return json({ error: itemsErr.message }, 500);
    if (!srcItems || srcItems.length !== itemIds.length) {
      return json({ error: 'Algunos items no existen' }, 400);
    }

    for (const it of srcItems) {
      if ((it as any).quotes.organization_id !== organization_id) {
        return json({ error: 'Item fuera de la organización' }, 403);
      }
      if ((it as any).grouped_into_quote_id) {
        return json({ error: `Item ${it.id} ya está agrupado` }, 409);
      }
    }

    // Generate document number for new quote
    const { data: numData, error: numErr } = await db.rpc('next_document_number', {
      p_organization_id: organization_id,
      p_document_type: 'quote',
    });
    if (numErr || !numData || (numData as any[]).length === 0) {
      return json({ error: 'No se pudo generar el número de presupuesto: ' + (numErr?.message || 'sin datos') }, 500);
    }
    const newQuoteNumber = (numData as any[])[0].document_number as string;

    // Compute total as sum of source item prices (cantidad principal/aprobada)
    const totalPrice = srcItems.reduce((sum, it: any) => sum + Number(it.price || 0), 0);

    // Insert new quote (draft, no multi-quantity logic at this level)
    const { data: newQuote, error: insertQuoteErr } = await db
      .from('quotes')
      .insert({
        user_id: userId,
        organization_id,
        customer_id,
        quote_number: newQuoteNumber,
        status: 'draft',
        final_price: totalPrice,
        description: notes || null,
        product_name: 'Presupuesto agrupado',
      })
      .select('id, quote_number')
      .single();

    if (insertQuoteErr || !newQuote) {
      return json({ error: 'Error al crear el presupuesto: ' + (insertQuoteErr?.message || 'desconocido') }, 500);
    }

    // Deep copy items
    const newItemsPayload = srcItems.map((src: any) => {
      const {
        id: _ignoreId,
        created_at: _c,
        updated_at: _u,
        quote_id: _q,
        quotes: _qq,
        grouped_into_quote_id: _g,
        source_quote_id: _sq,
        source_item_id: _si,
        // 'multi' field: keep only main/approved quantity → strip rows
        multi: _multi,
        ...rest
      } = src;
      return {
        ...rest,
        quote_id: newQuote.id,
        source_quote_id: src.quote_id,
        source_item_id: src.id,
        grouped_into_quote_id: null,
        multi: null,
      };
    });

    const { error: insertItemsErr } = await db.from('quote_items').insert(newItemsPayload);
    if (insertItemsErr) {
      // Rollback: remove the new quote
      await db.from('quotes').delete().eq('id', newQuote.id);
      return json({ error: 'Error copiando items: ' + insertItemsErr.message }, 500);
    }

    // Mark source items as grouped
    const { error: markErr } = await db
      .from('quote_items')
      .update({ grouped_into_quote_id: newQuote.id })
      .in('id', itemIds);
    if (markErr) {
      await db.from('quote_items').delete().eq('quote_id', newQuote.id);
      await db.from('quotes').delete().eq('id', newQuote.id);
      return json({ error: 'Error marcando items origen: ' + markErr.message }, 500);
    }

    // Mark each distinct source quote as 'grouped'
    const sourceQuoteIds = Array.from(new Set(srcItems.map((it: any) => it.quote_id)));
    const nowIso = new Date().toISOString();
    const { error: srcUpdateErr } = await db
      .from('quotes')
      .update({ status: 'grouped', grouped_at: nowIso })
      .in('id', sourceQuoteIds);
    if (srcUpdateErr) {
      console.error('No se pudo actualizar estado de presupuestos origen:', srcUpdateErr.message);
    }

    // Invalidate any portal tokens of source quotes (best-effort, table may not exist in some envs)
    try {
      await db.from('quote_portal_tokens').delete().in('quote_id', sourceQuoteIds);
    } catch (_) { /* ignore */ }

    return json({ quote_id: newQuote.id, quote_number: newQuote.quote_number }, 200);
  } catch (e: any) {
    return json({ error: e?.message || 'Error inesperado' }, 500);
  }
});