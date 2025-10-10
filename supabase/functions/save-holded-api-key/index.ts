import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Save Holded API Key function started")

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, apiKey } = await req.json()

    if (!organizationId || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Organization ID and API key are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Saving API key for organization:', organizationId)

    // Get the Holded integration ID
    const { data: integrationData, error: integrationError } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .maybeSingle()

    if (integrationError || !integrationData) {
      console.error('Error finding Holded integration:', integrationError)
      return new Response(
        JSON.stringify({ error: 'Holded integration not found' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if organization integration access already exists
    const { data: existingAccess, error: checkError } = await supabase
      .from('organization_integration_access')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('integration_id', integrationData.id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing access:', checkError)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Store API key as bytea (column type requirement) but as simple text encoding
    const encoder = new TextEncoder();
    const apiKeyBytes = encoder.encode(apiKey);

    let result
    if (existingAccess) {
      // Update existing record
      const { data, error } = await supabase
        .from('organization_integration_access')
        .update({
          access_token_encrypted: apiKeyBytes,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccess.id)
        .select()

      result = { data, error }
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('organization_integration_access')
        .insert({
          organization_id: organizationId,
          integration_id: integrationData.id,
          access_token_encrypted: apiKeyBytes,
          is_active: true
        })
        .select()

      result = { data, error }
    }

    if (result.error) {
      console.error('Error saving API key:', result.error)
      return new Response(
        JSON.stringify({ error: 'Failed to save API key' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('API key saved successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})