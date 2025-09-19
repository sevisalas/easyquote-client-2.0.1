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

    // Get the Holded integration ID first
    const { data: holdedIntegration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .maybeSingle()

    if (integrationError || !holdedIntegration) {
      console.error('Holded integration not found:', integrationError)
      return new Response(
        JSON.stringify({ error: 'Holded integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the organization's access to Holded integration
    const { data: orgAccess, error: accessError } = await supabaseClient
      .from('organization_integration_access')
      .select('access_token, is_active')
      .eq('organization_id', organizationId)
      .eq('integration_id', holdedIntegration.id)
      .maybeSingle()

    if (accessError || !orgAccess?.is_active || !orgAccess.access_token) {
      console.error('Organization access to Holded not found or inactive:', accessError)
      return new Response(
        JSON.stringify({ error: 'Holded integration not active for this organization or API key missing' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = orgAccess.access_token
    if (!apiKey) {
      console.error('Holded API key not found for organization:', organizationId)
      return new Response(
        JSON.stringify({ error: 'Holded API key not configured for this organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Making request to Holded API for organization:', organizationId)

    // Call Holded API with the organization-specific API key
    const holdedResponse = await fetch('https://api.holded.com/api/invoicing/v1/contacts', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'key': apiKey
      }
    })

    if (!holdedResponse.ok) {
      const errorText = await holdedResponse.text()
      console.error('Holded API error for org', organizationId, ':', holdedResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Error fetching data from Holded API', details: errorText }),
        { status: holdedResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const holdedData = await holdedResponse.json()
    console.log('Holded API response for org', organizationId, '- contacts found:', holdedData?.length || 0)

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