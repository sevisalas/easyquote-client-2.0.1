-- Actualizar el perfil del superadmin con los datos correctos
UPDATE public.profiles 
SET 
  first_name = 'VDP',
  last_name = 'Admin',
  updated_at = now()
WHERE id = (SELECT id FROM auth.users WHERE email = 'vdp@tradsis.net');