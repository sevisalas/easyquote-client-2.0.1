import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret is configured - fail closed for security
    const webhookSecret = Deno.env.get('ZAPIER_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('ZAPIER_WEBHOOK_SECRET not configured - rejecting request for security');
      return new Response(
        JSON.stringify({ error: 'Webhook authentication not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature using HMAC SHA-256
    const signature = req.headers.get('x-zapier-signature');
    const body = await req.text();
    
    if (!signature) {
      console.error('Missing webhook signature');
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    
    const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    if (signature !== expectedSignatureHex) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the already-read body
    const bodyData = JSON.parse(body);

    console.log('Zapier webhook received:', bodyData);

    // Validate required fields
    const { 
      id: holdedId, 
      name, 
      email, 
      phone, 
      mobile,
      organizationId
    } = bodyData;

    if (!holdedId || !organizationId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: id and organizationId',
          received: bodyData 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate organizationId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(organizationId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid organizationId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate name length
    if (!name || name.trim().length === 0 || name.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Name must be between 1 and 255 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email if provided
    if (email && (typeof email !== 'string' || email.length > 255)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format or length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      console.error('Organization not found:', organizationId);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization owner user_id
    const { data: org } = await supabase
      .from('organizations')
      .select('api_user_id')
      .eq('id', body.organizationId)
      .single();

    if (!org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert or update contact in customers table with source='holded'
    const { data, error } = await supabase
      .from('customers')
      .upsert({
        holded_id: holdedId,
        organization_id: body.organizationId,
        user_id: org.api_user_id,
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || body.mobile?.trim() || null,
        source: 'holded'
      }, {
        onConflict: 'holded_id,organization_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting contact:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Contact upserted successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        contact: data,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing Zapier webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
