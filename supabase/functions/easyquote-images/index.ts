import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const EASYQUOTE_API_BASE = 'https://api.easyquote.cloud/api/v1'

async function getEasyQuoteToken(userId: string): Promise<string | null> {
  try {
    // Use the organization-aware credentials function
    const { data, error } = await supabaseAdmin.rpc('get_organization_easyquote_credentials', {
      p_user_id: userId
    })

    if (error) {
      console.error('Error getting EasyQuote credentials:', error)
      return null
    }

    // RPC returns an array, get first row
    const credentials = Array.isArray(data) ? data[0] : data
    
    if (!credentials || !credentials.api_username || !credentials.api_password) {
      console.error('No EasyQuote credentials found for user:', userId)
      return null
    }

    console.log('Got credentials for user, authenticating with EasyQuote...')

    // Authenticate with EasyQuote API (correct endpoint: /users/authenticate with email field)
    const authResponse = await fetch(`${EASYQUOTE_API_BASE}/users/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.api_username,
        password: credentials.api_password,
      }),
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('EasyQuote auth failed:', authResponse.status, errorText)
      return null
    }

    const authData = await authResponse.json()
    console.log('EasyQuote auth successful')
    return authData.token || authData.access_token || null
  } catch (err) {
    console.error('Error authenticating with EasyQuote:', err)
    return null
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get EasyQuote token
    const easyquoteToken = await getEasyQuoteToken(user.id)
    if (!easyquoteToken) {
      // Use 502 Bad Gateway instead of 401 to avoid triggering session logout
      return new Response(
        JSON.stringify({ error: 'Could not authenticate with EasyQuote API', code: 'EASYQUOTE_AUTH_FAILED' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse URL to get image ID if present
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const imageId = pathSegments[pathSegments.length - 1]

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (imageId && imageId !== 'easyquote-images') {
          // Get single image from EasyQuote API
          const response = await fetch(`${EASYQUOTE_API_BASE}/images/${imageId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${easyquoteToken}`,
            },
          })

          if (!response.ok) {
            if (response.status === 404) {
              return new Response(
                JSON.stringify({ error: 'Image not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
            throw new Error(`EasyQuote API error: ${response.status}`)
          }

          const imageData = await response.json()
          return new Response(
            JSON.stringify(imageData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // List all images from EasyQuote API
          const response = await fetch(`${EASYQUOTE_API_BASE}/images`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${easyquoteToken}`,
            },
          })

          if (!response.ok) {
            throw new Error(`EasyQuote API error: ${response.status}`)
          }

          const images = await response.json()
          return new Response(
            JSON.stringify(images),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'POST':
        // Upload image to EasyQuote API
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
          return new Response(
            JSON.stringify({ error: 'No file provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate file
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
          return new Response(
            JSON.stringify({ error: 'File too large. Maximum 10MB allowed.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
          return new Response(
            JSON.stringify({ error: 'Invalid file type. Only JPG, PNG, WebP and GIF are allowed.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Forward the file to EasyQuote API
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)

        const uploadResponse = await fetch(`${EASYQUOTE_API_BASE}/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${easyquoteToken}`,
          },
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('EasyQuote upload error:', errorText)
          return new Response(
            JSON.stringify({ error: `Upload failed: ${uploadResponse.status}` }),
            { status: uploadResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const uploadResult = await uploadResponse.json()
        console.log('Image uploaded to EasyQuote:', uploadResult)

        return new Response(
          JSON.stringify(uploadResult),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'DELETE':
        if (!imageId || imageId === 'easyquote-images') {
          return new Response(
            JSON.stringify({ error: 'Image ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Delete from EasyQuote API
        const deleteResponse = await fetch(`${EASYQUOTE_API_BASE}/images/${imageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${easyquoteToken}`,
          },
        })

        if (!deleteResponse.ok) {
          if (deleteResponse.status === 404) {
            return new Response(
              JSON.stringify({ error: 'Image not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw new Error(`EasyQuote API error: ${deleteResponse.status}`)
        }

        return new Response(
          JSON.stringify({ message: 'Image deleted successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error in easyquote-images function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
