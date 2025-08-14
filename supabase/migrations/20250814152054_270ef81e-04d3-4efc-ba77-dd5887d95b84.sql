-- Eliminar el usuario vdp@tradsis.net creado incorrectamente
DELETE FROM public.profiles WHERE id = '08cb1bf3-4007-4a60-8762-846121454f89';
DELETE FROM auth.users WHERE email = 'vdp@tradsis.net';