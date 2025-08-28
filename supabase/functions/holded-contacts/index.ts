import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { organizationId } = await req.json()

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the Holded integration configuration
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('configuration, is_active')
      .eq('organization_id', organizationId)
      .eq('integration_type', 'holded')
      .maybeSingle()

    if (integrationError || !integration?.is_active) {
      return new Response(
        JSON.stringify({ error: 'Holded integration not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = integration.configuration?.apiKey
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Holded API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Holded API
    const holdedResponse = await fetch('https://api.holded.com/api/invoicing/v1/contacts', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'key': apiKey
      }
    })

    if (!holdedResponse.ok) {
      console.error('Holded API error:', holdedResponse.status, await holdedResponse.text())
      return new Response(
        JSON.stringify({ error: 'Error fetching data from Holded API' }),
        { status: holdedResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const holdedData = await holdedResponse.json()

    // Transform Holded contacts to our format
    const contacts = holdedData.map((contact: any) => ({
      id: contact.id,
      name: contact.name || contact.customName || 'Sin nombre',
      email: contact.email,
      phone: contact.phone,
      address: contact.billAddress,
      vatNumber: contact.vatNumber,
      // Add more fields as needed
    }))

    return new Response(
      JSON.stringify({ contacts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})