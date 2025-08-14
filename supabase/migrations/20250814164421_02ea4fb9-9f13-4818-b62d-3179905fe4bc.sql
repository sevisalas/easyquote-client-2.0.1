-- Crear una vista para obtener emails de usuarios sin usar la API admin
CREATE OR REPLACE VIEW public.organization_users AS
SELECT 
  om.id,
  om.organization_id,
  om.user_id,
  om.role,
  om.created_at,
  om.updated_at,
  au.email,
  au.created_at as user_created_at
FROM organization_members om
JOIN auth.users au ON om.user_id = au.id;

-- Crear política para que solo superadmins y API users puedan ver esta vista
ALTER VIEW public.organization_users SET (security_invoker = on);

-- RLS para la vista
CREATE POLICY "superadmin_and_api_users_view_org_users" ON public.organization_users
FOR SELECT
USING (
  is_superadmin() OR 
  EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = organization_users.organization_id 
    AND o.api_user_id = auth.uid()
  )
);