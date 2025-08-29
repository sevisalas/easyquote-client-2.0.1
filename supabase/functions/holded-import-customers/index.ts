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

    const holdedContacts = allContacts
    console.log(`Total found ${holdedContacts.length} contacts from Holded`)

    // Process contacts in batches to avoid overwhelming the database
    const batchSize = 50
    let imported = 0
    let updated = 0
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

          // First try to find existing customer with this holded_id
          const { data: existingCustomer } = await supabaseClient
            .from('customers')
            .select('id')
            .eq('user_id', user.id)
            .eq('holded_id', contact.id.toString())
            .maybeSingle()

          if (existingCustomer) {
            // Update existing customer
            const { error: updateError } = await supabaseClient
              .from('customers')
              .update({
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                notes: customerData.notes
              })
              .eq('id', existingCustomer.id)

            if (updateError) {
              console.error('Error updating customer:', contact.id, updateError)
              errors++
            } else {
              console.log('Successfully updated customer:', contact.id, contact.name)
              updated++
            }
          } else {
            // Insert new customer
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