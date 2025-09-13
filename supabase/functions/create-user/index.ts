import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Create a Supabase client with the service role key
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
    // Verify the user is authenticated and is a superadmin
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the JWT token from the Authorization header
    const token = authorization.replace('Bearer ', '')
    
    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token or user not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is superadmin or organization admin
    const isSuperAdmin = user.email === 'vdp@tradsis.net';
    let isOrgAdmin = false;

    if (!isSuperAdmin) {
      // Check if user is owner of an organization (API user)
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('api_user_id', user.id)
        .maybeSingle();

      if (orgData) {
        isOrgAdmin = true;
      } else {
        // Check if user is admin member of an organization  
        const { data: memberData, error: memberError } = await supabaseAdmin
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (memberData) {
          isOrgAdmin = true;
        }
      }
    }

    if (!isSuperAdmin && !isOrgAdmin) {
      return new Response(
        JSON.stringify({ error: 'Not authorized. Only superadmin or organization admins can create users.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the request body
    const { email, password, role = 'user', organizationId } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create user using admin API - bypass email validation for test domains
    const isTestEmail = email.includes('@test') || email.includes('@example') || email.includes('@demo');
    const emailToUse = isTestEmail ? email.replace(/@.*/, '@gmail.com') : email;
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailToUse,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        original_email: email // Store the original email they wanted
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If organizationId is provided and user is not superadmin, add user to organization
    if (organizationId && !isSuperAdmin && newUser.user) {
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: newUser.user.id,
          role: role
        });

      if (memberError) {
        console.error('Error adding user to organization:', memberError);
        // Don't fail the entire operation, just log the error
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user?.id,
          email: newUser.user?.email,
          created_at: newUser.user?.created_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})