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

    // Get the user from the authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // Call Holded API to get contacts
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

    const holdedContacts = await holdedResponse.json()
    
    console.log(`Found ${holdedContacts.length} contacts from Holded`)

    // Process contacts in batches to avoid overwhelming the database
    const batchSize = 50
    let imported = 0
    let updated = 0
    let errors = 0

    for (let i = 0; i < holdedContacts.length; i += batchSize) {
      const batch = holdedContacts.slice(i, i + batchSize)
      
      for (const contact of batch) {
        try {
          const customerData = {
            id: contact.id,
            user_id: user.id,
            name: contact.name || contact.customName || 'Sin nombre'
          }

          // Try to upsert the customer
          const { error: upsertError } = await supabaseClient
            .from('customers')
            .upsert(customerData, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })

          if (upsertError) {
            console.error('Error upserting customer:', upsertError)
            errors++
          } else {
            // Check if it was an insert or update
            const { data: existing } = await supabaseClient
              .from('customers')
              .select('created_at')
              .eq('id', contact.id)
              .single()
            
            if (existing) {
              const createdAt = new Date(existing.created_at)
              const now = new Date()
              const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60)
              
              if (diffMinutes < 1) {
                imported++
              } else {
                updated++
              }
            }
          }
        } catch (error) {
          console.error('Error processing contact:', error)
          errors++
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const result = {
      total: holdedContacts.length,
      imported,
      updated,
      errors,
      message: `Importación completada: ${imported} nuevos, ${updated} actualizados, ${errors} errores`
    }

    console.log('Import result:', result)

    return new Response(
      JSON.stringify(result),
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