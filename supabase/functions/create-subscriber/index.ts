import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Verificar que el usuario que llama es superadmin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar rol de superadmin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'superadmin')
      .maybeSingle();

    if (!roles) {
      throw new Error('Unauthorized: Only superadmins can create subscribers');
    }

    const {
      organizationName,
      adminEmail,
      adminPassword,
      subscriptionPlan,
      excelLimit,
      excelExtra,
      clientUserLimit,
      clientUserExtra
    } = await req.json();

    // Validaciones
    if (!organizationName || !adminEmail || !adminPassword) {
      throw new Error('Missing required fields');
    }

    if (adminPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // 1. Crear el usuario administrador
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (createUserError) {
      throw new Error(`Error creating user: ${createUserError.message}`);
    }

    if (!newUser.user) {
      throw new Error('User creation failed');
    }

    // 2. Crear la organización
    const orgData: any = {
      name: organizationName,
      api_user_id: newUser.user.id,
      subscription_plan: subscriptionPlan,
      excel_limit: excelLimit || 0,
      excel_extra: excelExtra || 0,
      client_user_limit: clientUserLimit || 0,
      client_user_extra: clientUserExtra || 0,
    };

    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert(orgData)
      .select()
      .single();

    if (orgError) {
      // Si falla la creación de la organización, eliminar el usuario creado
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Error creating organization: ${orgError.message}`);
    }

    // 3. Crear el member en organization_members
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: organization.id,
        user_id: newUser.user.id,
        role: 'admin',
        display_name: adminEmail.split('@')[0],
      });

    if (memberError) {
      // Si falla, hacer rollback eliminando la organización y el usuario
      await supabaseAdmin.from('organizations').delete().eq('id', organization.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Error creating member: ${memberError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization: organization,
        userId: newUser.user.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-subscriber:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
