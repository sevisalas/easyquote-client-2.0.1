import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ---- Authentication & authorization ----
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { organizationId } = await req.json()

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Allow: superadmin, organization owner (organizations.api_user_id),
    // or a member of the requested organization.
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
    const isSuperAdmin = (roles || []).some((r: any) => r.role === 'superadmin')

    let allowed = isSuperAdmin
    if (!allowed) {
      const { data: ownerOrg } = await supabaseClient
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .eq('api_user_id', caller.id)
        .maybeSingle()
      if (ownerOrg) allowed = true
    }
    if (!allowed) {
      const { data: membership } = await supabaseClient
        .from('organization_members')
        .select('id')
        .eq('user_id', caller.id)
        .eq('organization_id', organizationId)
        .maybeSingle()
      if (membership) allowed = true
    }
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    console.log('📋 Getting users for organization:', organizationId)

    // Get organization members ONLY
    const { data: members, error: membersError } = await supabaseClient
      .from('organization_members')
      .select('user_id, role, display_name, cuenta_holded')
      .eq('organization_id', organizationId)

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return new Response(
        JSON.stringify({ error: membersError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('👥 Found members:', members?.length || 0)

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ users: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Get user details from auth.users for members only
    const users = []
    for (const member of members) {
      const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(member.user_id)

      if (userError) {
        console.error(`Error fetching user ${member.user_id}:`, userError)
        continue
      }

      if (userData.user) {
        users.push({
          id: userData.user.id,
          email: userData.user.email,
          role: member.role,
          display_name: member.display_name,
          cuenta_holded: member.cuenta_holded,
          created_at: userData.user.created_at
        })
      }
    }

    console.log('✅ Returning', users.length, 'users')

    return new Response(
      JSON.stringify({ users }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
