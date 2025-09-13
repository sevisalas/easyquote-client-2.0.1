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
    const { email, password, role = 'user', organizationId, organizationName, subscriptionPlan } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers.users?.some(user => user.email === email)
    
    if (userExists) {
      console.log('User already exists with email:', email)
      return new Response(
        JSON.stringify({ 
          error: `El usuario con email ${email} ya existe en el sistema. Usa un email diferente o contacta al administrador.`,
          code: 'USER_EXISTS'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


    // Create user directly with admin API - bypasses all signup restrictions
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so no email needed
      user_metadata: {
        created_by_admin: true
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser.user) {
      console.error('User creation returned null user')
      return new Response(
        JSON.stringify({ error: 'User creation failed - no user returned' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User created successfully:', newUser.user.email)

    let organizationData = null;

    // If this is a superadmin creating an organization (new subscriber)
    if (isSuperAdmin && organizationName && subscriptionPlan) {
      console.log('Creating organization:', organizationName, 'for user:', newUser.user.id)
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: organizationName,
          subscription_plan: subscriptionPlan,
          api_user_id: newUser.user.id,
        })
        .select()
        .single();

      if (orgError) {
        console.error('Error creating organization:', orgError);
        // Delete the user if organization creation fails
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return new Response(
          JSON.stringify({ error: 'Error creating organization: ' + orgError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('Organization created successfully:', orgData.id)
      organizationData = orgData;
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
        },
        organization: organizationData
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