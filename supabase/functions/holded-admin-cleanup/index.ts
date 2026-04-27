import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('No auth');
    const { data: { user }, error: aerr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (aerr || !user) throw new Error('Unauthorized');

    // Only superadmins
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'superadmin')
      .maybeSingle();
    if (!roleRow) throw new Error('Forbidden: superadmin only');

    const body = await req.json().catch(() => ({}));
    const { organizationId, action, docType, docId, since } = body as {
      organizationId: string;
      action: 'list' | 'delete';
      docType: 'salesorder' | 'estimate';
      docId?: string;
      since?: number; // unix seconds
    };

    if (!organizationId || !action || !docType) throw new Error('Missing params');

    // Resolve Holded API key for this org
    const { data: integ } = await supabase
      .from('integrations')
      .select('id')
      .eq('integration_type', 'holded')
      .maybeSingle();
    if (!integ) throw new Error('Holded integration row not found');

    const { data: access } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', organizationId)
      .eq('integration_id', integ.id)
      .maybeSingle();
    if (!access?.access_token_encrypted) throw new Error('No Holded api key for org');

    const { data: dec, error: derr } = await supabase.rpc('decrypt_credential', {
      encrypted_data: access.access_token_encrypted,
    });
    if (derr) throw derr;
    const apiKey = dec as string;

    const base = `https://api.holded.com/api/invoicing/v1/documents/${docType}`;

    if (action === 'list') {
      const url = since ? `${base}?starttmp=${since}` : base;
      const r = await fetch(url, { headers: { key: apiKey, accept: 'application/json' } });
      const txt = await r.text();
      let data: any;
      try { data = JSON.parse(txt); } catch { data = txt; }
      // Trim noisy fields
      const trimmed = Array.isArray(data)
        ? data.map((d: any) => ({
            id: d.id, docNumber: d.docNumber, total: d.total, subtotal: d.subtotal,
            date: d.date, contactName: d.contactName, status: d.status, currency: d.currency,
          }))
        : data;
      return new Response(JSON.stringify({ ok: true, count: Array.isArray(data) ? data.length : 0, data: trimmed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      if (!docId) throw new Error('docId required');
      const r = await fetch(`${base}/${docId}`, {
        method: 'DELETE',
        headers: { key: apiKey, accept: 'application/json' },
      });
      const txt = await r.text();
      return new Response(JSON.stringify({ ok: r.ok, status: r.status, body: txt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Unknown action');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});