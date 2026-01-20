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

    // Get user's organization from sessionStorage header or organization_members
    const orgIdHeader = req.headers.get('X-Organization-Id')
    let organizationId: string | null = null

    if (orgIdHeader) {
      organizationId = orgIdHeader
    } else {
      // Fallback: get first organization from membership
      const { data: membership } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      
      organizationId = membership?.organization_id || null
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization not found for user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          // Get single image from local database
          const { data: image, error: fetchError } = await supabaseAdmin
            .from('images')
            .select('*')
            .eq('id', imageId)
            .eq('organization_id', organizationId)
            .single()

          if (fetchError || !image) {
            return new Response(
              JSON.stringify({ error: 'Image not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Get signed URL for the image
          const { data: urlData } = await supabaseAdmin.storage
            .from('product-images')
            .createSignedUrl(image.storage_path, 3600) // 1 hour expiry

          return new Response(
            JSON.stringify({
              id: image.id,
              filename: image.filename,
              original_filename: image.original_filename,
              dateCreated: image.created_at,
              url: urlData?.signedUrl || null,
              mime_type: image.mime_type,
              file_size: image.file_size,
              width: image.width,
              height: image.height,
              tags: image.tags || [],
              description: image.description,
              variants: {
                original: {
                  medium: urlData?.signedUrl || null,
                },
                square: {
                  medium: urlData?.signedUrl || null,
                }
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // List all images from local database
          const { data: images, error: listError } = await supabaseAdmin
            .from('images')
            .select('*, category:image_categories(id, name, color)')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })

          if (listError) {
            console.error('Error fetching images from database:', listError)
            throw new Error(`Failed to fetch images: ${listError.message}`)
          }

          // Get signed URLs for all images
          const transformedImages = await Promise.all(
            (images || []).map(async (image: any) => {
              const { data: urlData } = await supabaseAdmin.storage
                .from('product-images')
                .createSignedUrl(image.storage_path, 3600)

              return {
                id: image.id,
                filename: image.filename,
                original_filename: image.original_filename,
                url: urlData?.signedUrl || null,
                mime_type: image.mime_type,
                file_size: image.file_size,
                width: image.width,
                category_id: image.category_id,
                category: image.category,
                height: image.height,
                tags: image.tags || [],
                description: image.description,
                created_at: image.created_at
              }
            })
          )

          return new Response(
            JSON.stringify(transformedImages),
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

        // Check if image with same original_filename already exists for this organization
        const { data: existingImage } = await supabaseAdmin
          .from('images')
          .select('id, storage_path')
          .eq('organization_id', organizationId)
          .eq('original_filename', file.name)
          .single()

        let fileName: string
        let resultImage: any

        if (existingImage) {
          // Update existing image: delete old file from storage
          await supabaseAdmin.storage
            .from('product-images')
            .remove([existingImage.storage_path])

          // Generate new filename using organization ID for better isolation
          const fileExt = file.name.split('.').pop()
          fileName = `${organizationId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

          // Upload new file
          const { error: uploadError } = await supabaseAdmin.storage
            .from('product-images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            })

          if (uploadError) {
            throw uploadError
          }

          // Update database record
          const { data: updatedImage, error: updateError } = await supabaseAdmin
            .from('images')
            .update({
              filename: fileName.split('/').pop() || fileName,
              file_size: file.size,
              mime_type: file.type,
              storage_path: fileName,
              tags: tags.length > 0 ? tags : undefined,
              description: description || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingImage.id)
            .select()
            .single()

          if (updateError) {
            throw updateError
          }

          resultImage = updatedImage
          console.log(`Image updated: ${file.name} (replaced existing)`)
        } else {
          // Create new image
          const fileExt = file.name.split('.').pop()
          fileName = `${organizationId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

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

          // Save metadata to database
          const { data: newImage, error: dbError } = await supabaseAdmin
            .from('images')
            .insert({
              user_id: user.id,
              organization_id: organizationId,
              filename: fileName.split('/').pop() || fileName,
              original_filename: file.name,
              file_size: file.size,
              mime_type: file.type,
              width: null,
              height: null,
              storage_path: fileName,
              tags,
              description,
            })
            .select()
            .single()

          if (dbError) {
            throw dbError
          }

          resultImage = newImage
          console.log(`New image created: ${file.name}`)
        }

        // Get signed URL for response
        const { data: urlData } = await supabaseAdmin.storage
          .from('product-images')
          .createSignedUrl(fileName, 3600)

        return new Response(
          JSON.stringify({
            id: resultImage.id,
            filename: resultImage.filename,
            original_filename: resultImage.original_filename,
            url: urlData?.signedUrl || null,
            mime_type: resultImage.mime_type,
            file_size: resultImage.file_size,
            width: resultImage.width,
            height: resultImage.height,
            tags: resultImage.tags,
            description: resultImage.description,
            created_at: resultImage.created_at,
            updated: !!existingImage
          }),
          { status: existingImage ? 200 : 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'PATCH':
        // Update image metadata
        if (!imageId || imageId === 'easyquote-images') {
          return new Response(
            JSON.stringify({ error: 'Image ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const updateBody = await req.json()
        const updateFields: any = {}
        
        if (updateBody.tags !== undefined) updateFields.tags = updateBody.tags
        if (updateBody.description !== undefined) updateFields.description = updateBody.description
        if (updateBody.category_id !== undefined) updateFields.category_id = updateBody.category_id

        const { data: updatedImg, error: updateErr } = await supabaseAdmin
          .from('images')
          .update(updateFields)
          .eq('id', imageId)
          .eq('organization_id', organizationId)
          .select()
          .single()

        if (updateErr) {
          throw updateErr
        }

        return new Response(
          JSON.stringify(updatedImg),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          .eq('organization_id', organizationId)
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
          .eq('organization_id', organizationId)

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
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})