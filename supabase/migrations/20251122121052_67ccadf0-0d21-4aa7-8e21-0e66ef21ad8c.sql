
-- Crear perfiles faltantes para usuarios que están en organization_members pero no en profiles
INSERT INTO public.profiles (user_id, first_name, created_at, updated_at)
SELECT 
  om.user_id,
  COALESCE(om.display_name, 'Usuario'),
  NOW(),
  NOW()
FROM organization_members om
LEFT JOIN profiles p ON om.user_id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Actualizar organization_id de customers que tienen null usando el user_id del creador
UPDATE public.customers c
SET organization_id = om.organization_id
FROM organization_members om
WHERE c.user_id = om.user_id 
AND c.organization_id IS NULL;

-- Actualizar organization_id de customers que no tienen user_id pero fueron creados por el api_user
UPDATE public.customers c
SET organization_id = o.id
FROM organizations o
WHERE c.user_id = o.api_user_id
AND c.organization_id IS NULL;
