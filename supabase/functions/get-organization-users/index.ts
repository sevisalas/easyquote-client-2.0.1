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

    // Get organization members ONLY
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
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
