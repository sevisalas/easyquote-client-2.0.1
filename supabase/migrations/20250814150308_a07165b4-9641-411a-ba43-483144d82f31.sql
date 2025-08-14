-- Crear el usuario superadmin vdp@tradsis.net en Supabase Auth
SELECT auth.admin_create_user(
  email := 'vdp@tradsis.net',
  password := '1234',
  email_confirm := true
);

-- Verificar que el usuario se creó
SELECT id, email FROM auth.users WHERE email = 'vdp@tradsis.net';