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

    const { organizationId } = await req.json()

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('📋 Getting users for organization:', organizationId)

    // Get organization members
    const { data: members, error: membersError } = await supabaseClient
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)

    if (membersError) {
      console.error('Error fetching members:', membersError)
      return new Response(
        JSON.stringify({ error: membersError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('👥 Found members:', members?.length || 0)

    // Get the organization owner (api_user_id)
    const { data: org, error: orgError } = await supabaseClient
      .from('organizations')
      .select('api_user_id')
      .eq('id', organizationId)
      .single()

    if (orgError) {
      console.error('Error fetching organization:', orgError)
      return new Response(
        JSON.stringify({ error: orgError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('🏢 Organization owner:', org?.api_user_id)

    // Collect all unique user IDs (members + owner)
    const userIds = new Set<string>()
    
    if (members && members.length > 0) {
      members.forEach(member => userIds.add(member.user_id))
    }
    
    if (org?.api_user_id) {
      userIds.add(org.api_user_id)
    }

    if (userIds.size === 0) {
      console.log('⚠️ No users found')
      return new Response(
        JSON.stringify({ users: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log('🔍 Total unique user IDs to fetch:', userIds.size)

    // Get user details from auth.users
    const users = []
    for (const userId of userIds) {
      const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(userId)

      if (userError) {
        console.error(`Error fetching user ${userId}:`, userError)
        continue
      }

      if (userData.user) {
        // Find the role for this user
        const memberData = members?.find(m => m.user_id === userId)
        const isOwner = userId === org?.api_user_id
        
        users.push({
          id: userData.user.id,
          email: userData.user.email,
          role: isOwner ? 'owner' : (memberData?.role || 'user'),
          created_at: userData.user.created_at,
          is_owner: isOwner
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
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
