import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, dryRun = false } = await req.json();
    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'organizationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Holded API key
    const { data: integration } = await supabase
      .from('integrations').select('id').eq('name', 'Holded').single();
    if (!integration) throw new Error('Holded integration not found');

    const { data: access } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', organizationId)
      .eq('integration_id', integration.id)
      .single();
    if (!access?.access_token_encrypted) throw new Error('Holded not configured');

    const { data: decrypted } = await supabase
      .rpc('decrypt_credential', { encrypted_data: access.access_token_encrypted });
    if (!decrypted) throw new Error('Failed to decrypt key');
    const apiKey = String(decrypted).trim();

    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, holded_estimate_id, customer_id')
      .eq('organization_id', organizationId)
      .not('holded_estimate_id', 'is', null);

    const { data: orders } = await supabase
      .from('sales_orders')
      .select('id, order_number, holded_document_id, customer_id')
      .eq('organization_id', organizationId)
      .not('holded_document_id', 'is', null);

    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, holded_id')
      .eq('organization_id', organizationId);

    const customerByHolded = new Map<string, { id: string; name: string }>();
    for (const c of customers || []) {
      if (c.holded_id) customerByHolded.set(c.holded_id, { id: c.id, name: c.name });
    }

    const stats = {
      quotesChecked: 0, ordersChecked: 0,
      quotesReassigned: 0, ordersReassigned: 0,
      mismatchesNoLocalCustomer: 0, notFound: 0, errors: 0, ok: 0,
    };
    const reassignments: any[] = [];
    const skipped: any[] = [];

    const fetchHolded = async (kind: 'estimate' | 'salesorder', id: string) => {
      const r = await fetch(
        `https://api.holded.com/api/invoicing/v1/documents/${kind}/${id}`,
        { headers: { key: apiKey, Accept: 'application/json' } },
      );
      const text = await r.text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { /* ignore */ }
      return { ok: r.ok, status: r.status, body };
    };

    const processDoc = async (
      kind: 'quote' | 'order',
      docNumber: string,
      docId: string,
      holdedDocId: string,
      currentCustomerId: string,
    ) => {
      const result = await fetchHolded(kind === 'quote' ? 'estimate' : 'salesorder', holdedDocId);
      if (!result.ok || !result.body) {
        if (result.status === 404 || (result.body && result.body.status === 0)) {
          stats.notFound++;
        } else {
          stats.errors++;
        }
        return;
      }

      const holdedContactId: string | null = result.body.contact ?? result.body.contactId ?? null;
      if (!holdedContactId) return;

      const suggested = customerByHolded.get(holdedContactId);
      if (!suggested) {
        stats.mismatchesNoLocalCustomer++;
        skipped.push({ kind, docNumber, holdedContactId, reason: 'no local customer with this holded_id' });
        return;
      }

      if (suggested.id === currentCustomerId) {
        stats.ok++;
        return;
      }

      // Reassign
      reassignments.push({
        kind, docNumber, docId,
        from: currentCustomerId, to: suggested.id, toName: suggested.name,
      });

      if (!dryRun) {
        const table = kind === 'quote' ? 'quotes' : 'sales_orders';
        const { error } = await supabase
          .from(table).update({ customer_id: suggested.id }).eq('id', docId);
        if (error) {
          stats.errors++;
          return;
        }
      }
      if (kind === 'quote') stats.quotesReassigned++;
      else stats.ordersReassigned++;
    };

    for (const q of quotes || []) {
      stats.quotesChecked++;
      await processDoc('quote', q.quote_number, q.id, q.holded_estimate_id!, q.customer_id);
      await sleep(60);
    }
    for (const o of orders || []) {
      stats.ordersChecked++;
      await processDoc('order', o.order_number, o.id, o.holded_document_id!, o.customer_id);
      await sleep(60);
    }

    return new Response(
      JSON.stringify({ organizationId, dryRun, stats, reassignments, skipped }, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('reassign error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
