-- Verificar y eliminar completamente
DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'vdp@tradsis.net');
DELETE FROM auth.users WHERE email = 'vdp@tradsis.net';

-- Verificar que se eliminó
SELECT COUNT(*) as user_count FROM auth.users WHERE email = 'vdp@tradsis.net';