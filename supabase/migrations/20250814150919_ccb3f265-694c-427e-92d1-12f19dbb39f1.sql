-- Deshabilitar el trigger temporalmente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear el usuario VDP 
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'vdp@tradsis.net',
  crypt('1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);

-- Crear el perfil manualmente
INSERT INTO public.profiles (id, first_name, last_name)
SELECT id, 'VDP', 'Admin' FROM auth.users WHERE email = 'vdp@tradsis.net';

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();