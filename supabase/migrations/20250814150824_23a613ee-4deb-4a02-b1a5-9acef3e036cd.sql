-- Limpiar completamente y crear con UUID diferente
DELETE FROM public.profiles WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

-- Crear el usuario VDP con UUID aleatorio
WITH new_user AS (
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
  ) RETURNING id
)
INSERT INTO public.profiles (id, first_name, last_name)
SELECT id, 'VDP', 'Admin' FROM new_user;