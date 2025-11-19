import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Reprotel webhook received');

    // Verify API key from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providedApiKey = authHeader.replace('Bearer ', '');
    console.log('Received API key (first 10 chars):', providedApiKey.substring(0, 10));
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate API key using the database function
    const { data: organizationId, error: validationError } = await supabase
      .rpc('validate_api_key', { p_api_key: providedApiKey });

    console.log('Validation result - orgId:', organizationId, 'error:', validationError);

    if (validationError || !organizationId) {
      console.error('Invalid API key:', validationError);
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated organization:', organizationId);

    // Parse request body
    const bodyData = await req.json();
    console.log('Request data:', bodyData);

    // Sanitize name: replace smart quotes with regular quotes
    const sanitizeName = (name: string): string => {
      if (!name) return name;
      return name
        .replace(/[""]/g, '"')  // Replace smart double quotes
        .replace(/['']/g, "'")  // Replace smart single quotes
        .trim();
    };

    // Validate required fields
    const { 
      reprotel_id,
      id, // Alternative field name for reprotel_id
      name: rawName,
      email,
      phone,
      address
    } = bodyData;

    const name = sanitizeName(rawName);
    const reprotelId = reprotel_id || id;

    if (!reprotelId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required field: reprotel_id or id',
          received: bodyData 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get organization owner user_id
    const { data: org } = await supabase
      .from('organizations')
      .select('api_user_id')
      .eq('id', organizationId)
      .single();

    if (!org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert or update contact in customers table with source='reprotel'
    const { data, error } = await supabase
      .from('customers')
      .upsert({
        integration_id: reprotelId.toString(),
        organization_id: organizationId,
        user_id: org.api_user_id,
        name: name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        source: 'reprotel'
      }, {
        onConflict: 'integration_id,organization_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting customer:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create/update customer',
          details: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Contact upserted successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Contact created/updated successfully',
        data: data
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
