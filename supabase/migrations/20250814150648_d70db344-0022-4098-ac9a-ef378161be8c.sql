-- Eliminar completamente el usuario problemático y recrearlo correctamente
DELETE FROM public.profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'vdp@tradsis.net');
DELETE FROM auth.users WHERE email = 'vdp@tradsis.net';

-- Recrear el usuario usando la función de sign up de Supabase
SELECT auth.signup(
  email := 'vdp@tradsis.net',
  password := '1234',
  email_confirm := true
);