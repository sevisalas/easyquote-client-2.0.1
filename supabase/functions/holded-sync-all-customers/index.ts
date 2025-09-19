import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncProgress {
  totalPages: number;
  currentPage: number;
  totalContacts: number;
  syncedContacts: number;
  newContacts: number;
  errors: number;
  status: 'running' | 'completed' | 'error';
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { organizationId, fullSync = false } = await req.json()

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // Get Holded integration access
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .maybeSingle()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Holded integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: access, error: accessError } = await supabaseClient
      .from('organization_integration_access')
      .select('access_token, is_active')
      .eq('organization_id', organizationId)
      .eq('integration_id', integration.id)
      .maybeSingle()

    if (accessError || !access?.is_active || !access.access_token) {
      return new Response(
        JSON.stringify({ error: 'Holded integration not active or no access token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = access.access_token

    // Get existing Holded IDs if not full sync
    let existingHoldedIds = new Set<string>()
    if (!fullSync) {
      const { data: existingCustomers } = await supabaseClient
        .from('customers')
        .select('holded_id')
        .eq('user_id', user.id)
        .not('holded_id', 'is', null)

      existingHoldedIds = new Set(existingCustomers?.map(c => c.holded_id) || [])
    }

    // First, get total count
    const countResponse = await fetch('https://api.holded.com/api/invoicing/v1/contacts?limit=1&page=1', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'key': apiKey
      }
    })

    if (!countResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Error getting Holded contacts count' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Estimate total from headers or use conservative estimate
    const totalContacts = 22000 // You mentioned 22k contacts
    const contactsPerPage = 500
    const totalPages = Math.ceil(totalContacts / contactsPerPage)

    const progress: SyncProgress = {
      totalPages,
      currentPage: 0,
      totalContacts,
      syncedContacts: 0,
      newContacts: 0,
      errors: 0,
      status: 'running',
      message: 'Starting synchronization...'
    }

    // Define the background sync task
    const backgroundSync = async () => {
      console.log(`Starting Holded sync for ${totalPages} pages`)
      
      for (let page = 1; page <= totalPages; page++) {
        try {
          progress.currentPage = page
          progress.message = `Processing page ${page} of ${totalPages}...`
          
          const holdedResponse = await fetch(`https://api.holded.com/api/invoicing/v1/contacts?limit=${contactsPerPage}&page=${page}`, {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'key': apiKey
            }
          })

          if (!holdedResponse.ok) {
            console.error(`Error fetching page ${page}:`, holdedResponse.status)
            progress.errors++
            continue
          }

          const contacts = await holdedResponse.json()
          console.log(`Page ${page}: Found ${contacts.length} contacts`)

          if (contacts.length === 0) {
            console.log(`No more contacts found at page ${page}, finishing sync`)
            break
          }

          // Filter new contacts if not full sync
          const contactsToProcess = fullSync ? contacts : contacts.filter(contact => !existingHoldedIds.has(contact.id.toString()))
          
          // Process contacts in smaller batches
          const batchSize = 50
          for (let i = 0; i < contactsToProcess.length; i += batchSize) {
            const batch = contactsToProcess.slice(i, i + batchSize)
            
            for (const contact of batch) {
              try {
                const customerData = {
                  user_id: user.id,
                  holded_id: contact.id.toString(),
                  name: contact.name || contact.customName || 'Sin nombre',
                  email: contact.email || null,
                  phone: contact.phone || null,
                  address: contact.billAddress?.address || null,
                  notes: contact.customName ? `Custom Name: ${contact.customName}` : null
                }

                if (fullSync) {
                  // Upsert for full sync
                  const { error: upsertError } = await supabaseClient
                    .from('customers')
                    .upsert(customerData, { 
                      onConflict: 'user_id,holded_id',
                      ignoreDuplicates: false 
                    })

                  if (upsertError) {
                    console.error('Error upserting customer:', contact.id, upsertError)
                    progress.errors++
                  } else {
                    progress.syncedContacts++
                  }
                } else {
                  // Insert only new contacts
                  const { error: insertError } = await supabaseClient
                    .from('customers')
                    .insert(customerData)

                  if (insertError) {
                    console.error('Error inserting customer:', contact.id, insertError)
                    progress.errors++
                  } else {
                    progress.newContacts++
                  }
                }
              } catch (error) {
                console.error('Error processing contact:', error)
                progress.errors++
              }
            }
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // Delay between pages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))

        } catch (error) {
          console.error(`Error processing page ${page}:`, error)
          progress.errors++
        }
      }

      progress.status = 'completed'
      progress.message = `Sync completed! ${fullSync ? 'Synced' : 'New'}: ${fullSync ? progress.syncedContacts : progress.newContacts}, Errors: ${progress.errors}`
      console.log('Holded sync completed:', progress)
    }

    // Start background sync using waitUntil
    EdgeRuntime.waitUntil(backgroundSync())

    // Return immediate response
    return new Response(
      JSON.stringify({
        message: 'Holded synchronization started in background',
        totalPages,
        estimatedContacts: totalContacts,
        syncType: fullSync ? 'full' : 'incremental'
      }),
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