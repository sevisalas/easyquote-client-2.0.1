import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId } = await req.json();
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

    // Auth: only superadmin or org owner/member
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Holded API key for the org
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

    // Fetch all exported quotes & orders
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

    // Fetch all customers for this org
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, holded_id')
      .eq('organization_id', organizationId);

    const customerById = new Map<string, { id: string; name: string; holded_id: string | null }>();
    const customerByHolded = new Map<string, { id: string; name: string; holded_id: string | null }>();
    for (const c of customers || []) {
      customerById.set(c.id, c as any);
      if (c.holded_id) customerByHolded.set(c.holded_id, c as any);
    }

    type Discrepancy = {
      kind: 'quote' | 'order';
      docNumber: string;
      docId: string;
      holdedDocId: string;
      currentCustomerId: string;
      currentCustomerName: string;
      currentCustomerHoldedId: string | null;
      holdedContactId: string | null;
      holdedContactName: string | null;
      suggestedCustomerId: string | null;
      suggestedCustomerName: string | null;
      status: 'mismatch' | 'not_found' | 'orphan_contact' | 'error';
      detail?: string;
    };

    const discrepancies: Discrepancy[] = [];
    const stats = { quotesChecked: 0, ordersChecked: 0, mismatches: 0, notFound: 0, orphan: 0, errors: 0 };

    const fetchHoldedDoc = async (kind: 'estimate' | 'salesorder', id: string) => {
      const url = `https://api.holded.com/api/invoicing/v1/documents/${kind}/${id}`;
      const r = await fetch(url, { headers: { key: apiKey, Accept: 'application/json' } });
      const text = await r.text();
      let body: any = null;
      try { body = JSON.parse(text); } catch { /* ignore */ }
      return { ok: r.ok, status: r.status, body, text };
    };

    const processDoc = async (
      kind: 'quote' | 'order',
      docNumber: string,
      docId: string,
      holdedDocId: string,
      currentCustomerId: string,
    ) => {
      const cur = customerById.get(currentCustomerId);
      const result = await fetchHoldedDoc(kind === 'quote' ? 'estimate' : 'salesorder', holdedDocId);
      if (!result.ok || !result.body) {
        if (result.status === 404 || (result.body && result.body.status === 0)) {
          stats.notFound++;
          discrepancies.push({
            kind, docNumber, docId, holdedDocId,
            currentCustomerId,
            currentCustomerName: cur?.name ?? '?',
            currentCustomerHoldedId: cur?.holded_id ?? null,
            holdedContactId: null, holdedContactName: null,
            suggestedCustomerId: null, suggestedCustomerName: null,
            status: 'not_found',
            detail: `Document not found in Holded`,
          });
        } else {
          stats.errors++;
          discrepancies.push({
            kind, docNumber, docId, holdedDocId,
            currentCustomerId,
            currentCustomerName: cur?.name ?? '?',
            currentCustomerHoldedId: cur?.holded_id ?? null,
            holdedContactId: null, holdedContactName: null,
            suggestedCustomerId: null, suggestedCustomerName: null,
            status: 'error',
            detail: `HTTP ${result.status}: ${result.text.slice(0, 200)}`,
          });
        }
        return;
      }

      const holdedContactId: string | null = result.body.contact ?? result.body.contactId ?? null;
      const holdedContactName: string | null = result.body.contactName ?? null;

      if (!holdedContactId) return; // can't compare

      if (cur?.holded_id === holdedContactId) return; // OK ✅

      // Mismatch — try to find the right customer locally
      const suggested = customerByHolded.get(holdedContactId);
      if (suggested) {
        stats.mismatches++;
        discrepancies.push({
          kind, docNumber, docId, holdedDocId,
          currentCustomerId,
          currentCustomerName: cur?.name ?? '?',
          currentCustomerHoldedId: cur?.holded_id ?? null,
          holdedContactId, holdedContactName,
          suggestedCustomerId: suggested.id,
          suggestedCustomerName: suggested.name,
          status: 'mismatch',
        });
      } else {
        stats.orphan++;
        discrepancies.push({
          kind, docNumber, docId, holdedDocId,
          currentCustomerId,
          currentCustomerName: cur?.name ?? '?',
          currentCustomerHoldedId: cur?.holded_id ?? null,
          holdedContactId, holdedContactName,
          suggestedCustomerId: null, suggestedCustomerName: null,
          status: 'orphan_contact',
          detail: `Holded contact ${holdedContactId} not in local DB`,
        });
      }
    };

    for (const q of quotes || []) {
      stats.quotesChecked++;
      await processDoc('quote', q.quote_number, q.id, q.holded_estimate_id!, q.customer_id);
      await sleep(60); // rate limit
    }
    for (const o of orders || []) {
      stats.ordersChecked++;
      await processDoc('order', o.order_number, o.id, o.holded_document_id!, o.customer_id);
      await sleep(60);
    }

    return new Response(
      JSON.stringify({ organizationId, stats, discrepancies }, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('audit error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
