import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
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

async function getEasyQuoteToken(userId: string, providedToken: string | null): Promise<string | null> {
  // If a valid token was provided by the frontend, use it directly
  if (providedToken) {
    console.log('Using provided EasyQuote token from frontend')
    return providedToken
  }

  // Fallback: authenticate using stored credentials
  console.log('No token provided, authenticating with stored credentials...')
  try {
    const { data, error } = await supabaseAdmin.rpc('get_organization_easyquote_credentials', {
      p_user_id: userId
    })

    if (error) {
      console.error('Error getting EasyQuote credentials:', error)
      return null
    }

    const credentials = Array.isArray(data) ? data[0] : data
    
    if (!credentials || !credentials.api_username || !credentials.api_password) {
      console.error('No EasyQuote credentials found for user:', userId)
      return null
    }

    const authResponse = await fetch(`${EASYQUOTE_API_BASE}/users/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    return authData.token || authData.access_token || null
  } catch (err) {
    console.error('Error authenticating with EasyQuote:', err)
    return null
  }
}

Deno.serve(async (req) => {
  console.log('=== easyquote-images request ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
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

    // Get EasyQuote token - prefer the one from frontend header
    const providedToken = req.headers.get('X-EasyQuote-Token')
    console.log('X-EasyQuote-Token present:', !!providedToken)
    const easyquoteToken = await getEasyQuoteToken(user.id, providedToken)
    if (!easyquoteToken) {
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
        // Check if this is a list request or file upload
        const contentType = req.headers.get('content-type') || ''
        
        if (contentType.includes('application/json')) {
          // Handle JSON body - list or get single image
          const body = await req.json()
          
          if (body.action === 'list') {
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
          } else if (body.action === 'get' && body.imageId) {
            // Get single image
            const response = await fetch(`${EASYQUOTE_API_BASE}/images/${body.imageId}`, {
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
          }
        }
        
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
        // EasyQuote API expects a JSON payload (Swagger shows application/json-patch+json)
        const fileBuffer = await file.arrayBuffer()
        const fileBytes = new Uint8Array(fileBuffer)
        const fileBase64 = encodeBase64(fileBytes)

        const payload = {
          fileName: file.name,
          file: fileBase64,
        }

        console.log('Uploading to EasyQuote (JSON):', {
          filename: file.name,
          type: file.type,
          size: file.size,
        })

        const uploadResponse = await fetch(`${EASYQUOTE_API_BASE}/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${easyquoteToken}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: JSON.stringify(payload),
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
