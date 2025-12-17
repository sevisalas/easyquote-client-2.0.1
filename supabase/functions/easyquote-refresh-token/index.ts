import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from JWT token in Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const jwtToken = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwtToken)

    if (userError || !user) {
      console.error('easyquote-refresh-token: Invalid JWT', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('easyquote-refresh-token: Authenticated user:', user.id)

    // Get organization credentials using service role (bypasses RLS)
    // This uses the get_organization_easyquote_credentials RPC with service role
    const { data: credentials, error: credError } = await supabaseAdmin.rpc('get_organization_easyquote_credentials', {
      p_user_id: user.id
    })

    if (credError) {
      console.error('easyquote-refresh-token: Error fetching credentials:', credError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!credentials || credentials.length === 0) {
      console.error('easyquote-refresh-token: No credentials found for user:', user.id)
      return new Response(
        JSON.stringify({ error: 'No EasyQuote credentials configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cred = credentials[0]
    if (!cred.api_username || !cred.api_password) {
      console.error('easyquote-refresh-token: Credentials missing username or password')
      return new Response(
        JSON.stringify({ error: 'Incomplete EasyQuote credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate with EasyQuote API server-side
    console.log('easyquote-refresh-token: Authenticating with EasyQuote...')
    const loginUrl = 'https://api.easyquote.cloud/api/v1/users/authenticate'
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: cred.api_username, 
        password: cred.api_password 
      }),
    })

    const responseText = await loginRes.text()
    let data: any
    try {
      data = responseText ? JSON.parse(responseText) : {}
    } catch (e) {
      console.error('easyquote-refresh-token: JSON parse error', e, responseText)
      return new Response(
        JSON.stringify({ error: 'Invalid response from EasyQuote API' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!loginRes.ok) {
      console.error('easyquote-refresh-token: EasyQuote auth failed', loginRes.status, data)
      return new Response(
        JSON.stringify({ 
          error: data?.message || 'EasyQuote authentication failed',
          code: 'EASYQUOTE_AUTH_FAILED'
        }),
        { status: loginRes.status === 401 ? 401 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const easyQuoteToken = data?.token
    if (!easyQuoteToken) {
      console.error('easyquote-refresh-token: No token in response', data)
      return new Response(
        JSON.stringify({ error: 'No token returned from EasyQuote' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optionally update subscriber plan (like easyquote-auth does)
    try {
      const tokenParts = easyQuoteToken.split('.')
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]))
        const subscriberId = payload.SubscriberID
        
        if (subscriberId) {
          const updateUrl = `https://api.easyquote.cloud/api/v1/subscribers/${subscriberId}`
          const updateRes = await fetch(updateUrl, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${easyQuoteToken}`
            },
            body: JSON.stringify({ 
              planId: '4c342046-9ac1-449a-9d1d-f59c417e1985' // Advance plan
            }),
          })
          
          if (updateRes.ok) {
            console.log('easyquote-refresh-token: subscriber plan updated to Advance')
          }
        }
      }
    } catch (planUpdateErr) {
      // Non-fatal error
      console.warn('easyquote-refresh-token: plan update error (non-fatal)', planUpdateErr)
    }

    console.log('easyquote-refresh-token: Token obtained successfully')
    
    // Return ONLY the token, never the credentials
    return new Response(JSON.stringify({ token: easyQuoteToken }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('easyquote-refresh-token: Unexpected error', err)
    return new Response(
      JSON.stringify({ error: 'Unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
