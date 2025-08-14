-- Insertar el usuario superadmin directamente en auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
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
  now(),
  now()
);