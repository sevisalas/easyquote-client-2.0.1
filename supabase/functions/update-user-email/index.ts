import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si es superadmin o admin de la organización
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id)
      .single();

    const isSuperAdmin = roles?.role === 'superadmin';

    // Collect organizations where caller is admin (used for cross-org check)
    let callerAdminOrgIds: string[] = [];
    if (!isSuperAdmin) {
      const { data: memberships } = await supabaseAdmin
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', authUser.id)
        .eq('role', 'admin');

      callerAdminOrgIds = (memberships || []).map((m: any) => m.organization_id);

      if (callerAdminOrgIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Only admins can update user emails.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { userId, newEmail } = await req.json();

    if (!userId || !newEmail) {
      return new Response(
        JSON.stringify({ error: 'userId and newEmail are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cross-org protection: non-superadmins may only edit users that belong
    // to one of their admin organizations. This blocks an org admin from
    // hijacking a superadmin or a user in another tenant.
    if (!isSuperAdmin) {
      const { data: targetMembership } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .in('organization_id', callerAdminOrgIds)
        .maybeSingle();

      if (!targetMembership) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: target user is not a member of your organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extra safety: block editing users that hold elevated platform roles.
      const { data: targetRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      if ((targetRoles || []).some((r: any) => r.role === 'superadmin')) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: cannot modify superadmin accounts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verificar si el email ya existe
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers.users.some(u => u.email === newEmail && u.id !== userId);

    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'Este email ya está en uso por otro usuario' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar el email del usuario
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    );

    if (updateError) {
      console.error('Error updating user email:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: updatedUser.user,
        message: 'Email actualizado exitosamente'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-user-email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
