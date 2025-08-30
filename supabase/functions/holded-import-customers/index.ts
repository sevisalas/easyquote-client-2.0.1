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

    // Get existing Holded IDs to only import new contacts
    const { data: existingCustomers } = await supabaseClient
      .from('customers')
      .select('holded_id')
      .eq('user_id', user.id)
      .not('holded_id', 'is', null)

    const existingHoldedIds = new Set(existingCustomers?.map(c => c.holded_id) || [])
    console.log(`Found ${existingHoldedIds.size} existing Holded contacts in database`)

    // Call Holded API to get contacts - limit to 100 for testing
    const holdedResponse = await fetch(`https://api.holded.com/api/invoicing/v1/contacts?limit=100&page=1`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'key': apiKey
      }
    })

    if (!holdedResponse.ok) {
      console.error('Holded API error:', holdedResponse.status, await holdedResponse.text())
      return new Response(
        JSON.stringify({ error: 'Error calling Holded API' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const allContacts = await holdedResponse.json()
    console.log(`Found ${allContacts.length} contacts from Holded API`)

    // Filter out contacts that already exist
    const newContacts = allContacts.filter(contact => !existingHoldedIds.has(contact.id.toString()))
    console.log(`${newContacts.length} new contacts to import (${allContacts.length - newContacts.length} already exist)`)

    const holdedContacts = newContacts

    // Process contacts in batches to avoid overwhelming the database
    const batchSize = 50
    let imported = 0
    let errors = 0

    for (let i = 0; i < holdedContacts.length; i += batchSize) {
      const batch = holdedContacts.slice(i, i + batchSize)
      
      for (const contact of batch) {
        try {
          // Store Holded ID in separate field and use it for upsert logic
          const customerData = {
            user_id: user.id,
            holded_id: contact.id.toString(), // Store original Holded ID
            name: contact.name || contact.customName || 'Sin nombre',
            email: contact.email || null,
            phone: contact.phone || null,
            notes: contact.customName ? `Custom Name: ${contact.customName}` : null
          }

          console.log('Processing contact:', contact.id, contact.name)

          // Insert new customer (we already filtered existing ones)
          const { error: insertError } = await supabaseClient
            .from('customers')
            .insert(customerData)

          if (insertError) {
            console.error('Error inserting customer:', contact.id, insertError)
            errors++
          } else {
            console.log('Successfully inserted customer:', contact.id, contact.name)
            imported++
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
      total: allContacts.length,
      new_found: holdedContacts.length,
      imported,
      errors,
      message: `Importación completada: ${imported} nuevos contactos importados de ${holdedContacts.length} encontrados (${allContacts.length - holdedContacts.length} ya existían)`
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