import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
        JSON.stringify({ error: 'Invalid token or user not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is superadmin or organization admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    
    const isSuperAdmin = roles?.some(r => r.role === 'superadmin') || false
    let isOrgAdmin = false
    const callerAdminOrgIds: string[] = []

    if (!isSuperAdmin) {
      const { data: ownedOrgs } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('api_user_id', user.id)

      for (const o of ownedOrgs || []) callerAdminOrgIds.push(o.id)

      const { data: adminMemberships } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('role', 'admin')

      for (const m of adminMemberships || []) callerAdminOrgIds.push(m.organization_id)

      if (callerAdminOrgIds.length > 0) isOrgAdmin = true
    }

    if (!isSuperAdmin && !isOrgAdmin) {
      return new Response(
        JSON.stringify({ error: 'Not authorized. Only superadmin or organization admins can change passwords.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, newPassword } = await req.json()

    if (!email || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Email and new password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const targetUser = existingUsers.users?.find(u => u.email === email)
    
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: `User with email ${email} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cross-org protection: non-superadmins may only reset passwords for
    // users that belong to one of their admin organizations, and may never
    // reset a superadmin's password.
    if (!isSuperAdmin) {
      const { data: targetRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUser.id)
      if ((targetRoles || []).some(r => r.role === 'superadmin')) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: cannot modify superadmin accounts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: targetMembership } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('user_id', targetUser.id)
        .in('organization_id', callerAdminOrgIds)
        .maybeSingle()

      if (!targetMembership) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: target user is not a member of your organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Update password
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Password updated successfully for:', email)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password updated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in update-user-password function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
