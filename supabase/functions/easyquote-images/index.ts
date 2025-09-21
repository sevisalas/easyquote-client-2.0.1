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

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authorization.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const imageId = pathSegments[pathSegments.length - 1]

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (imageId && imageId !== 'easyquote-images') {
          // Get single image
          const { data: image, error } = await supabaseAdmin
            .from('images')
            .select('*')
            .eq('id', imageId)
            .eq('user_id', user.id)
            .single()

          if (error || !image) {
            return new Response(
              JSON.stringify({ error: 'Image not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from('product-images')
            .getPublicUrl(image.storage_path)

          return new Response(
            JSON.stringify({
              id: image.id,
              filename: image.filename,
              original_filename: image.original_filename,
              url: urlData.publicUrl,
              mime_type: image.mime_type,
              file_size: image.file_size,
              width: image.width,
              height: image.height,
              tags: image.tags,
              description: image.description,
              created_at: image.created_at
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // List all images
          const { data: images, error } = await supabaseAdmin
            .from('images')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })

          if (error) {
            throw error
          }

          // Get public URLs for all images
          const imagesWithUrls = await Promise.all(
            images.map(async (image) => {
              const { data: urlData } = supabaseAdmin.storage
                .from('product-images')
                .getPublicUrl(image.storage_path)
              
              return {
                id: image.id,
                filename: image.filename,
                original_filename: image.original_filename,
                url: urlData.publicUrl,
                mime_type: image.mime_type,
                file_size: image.file_size,
                width: image.width,
                height: image.height,
                tags: image.tags,
                description: image.description,
                created_at: image.created_at
              }
            })
          )

          return new Response(
            JSON.stringify(imagesWithUrls),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'POST':
        // Upload image
        const formData = await req.formData()
        const file = formData.get('file') as File
        const tags = formData.get('tags') ? JSON.parse(formData.get('tags') as string) : []
        const description = formData.get('description') as string || undefined

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

        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

        // Upload to storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('product-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        // Get image dimensions (simplified - in a real implementation you'd use a proper image library)
        const dimensions = { width: null, height: null }

        // Save metadata to database
        const { data: newImage, error: dbError } = await supabaseAdmin
          .from('images')
          .insert({
            user_id: user.id,
            filename: fileName.split('/').pop() || fileName,
            original_filename: file.name,
            file_size: file.size,
            mime_type: file.type,
            width: dimensions.width,
            height: dimensions.height,
            storage_path: fileName,
            tags,
            description,
          })
          .select()
          .single()

        if (dbError) {
          throw dbError
        }

        // Get public URL for response
        const { data: urlData } = supabaseAdmin.storage
          .from('product-images')
          .getPublicUrl(fileName)

        return new Response(
          JSON.stringify({
            id: newImage.id,
            filename: newImage.filename,
            original_filename: newImage.original_filename,
            url: urlData.publicUrl,
            mime_type: newImage.mime_type,
            file_size: newImage.file_size,
            width: newImage.width,
            height: newImage.height,
            tags: newImage.tags,
            description: newImage.description,
            created_at: newImage.created_at
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'DELETE':
        if (!imageId || imageId === 'easyquote-images') {
          return new Response(
            JSON.stringify({ error: 'Image ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get image to delete
        const { data: imageToDelete, error: fetchError } = await supabaseAdmin
          .from('images')
          .select('storage_path')
          .eq('id', imageId)
          .eq('user_id', user.id)
          .single()

        if (fetchError || !imageToDelete) {
          return new Response(
            JSON.stringify({ error: 'Image not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Delete from storage
        const { error: storageError } = await supabaseAdmin.storage
          .from('product-images')
          .remove([imageToDelete.storage_path])

        if (storageError) {
          console.error('Storage deletion error:', storageError)
        }

        // Delete from database
        const { error: deleteError } = await supabaseAdmin
          .from('images')
          .delete()
          .eq('id', imageId)
          .eq('user_id', user.id)

        if (deleteError) {
          throw deleteError
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
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})