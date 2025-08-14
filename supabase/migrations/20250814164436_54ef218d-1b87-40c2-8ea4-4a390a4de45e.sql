-- Crear una función para obtener usuarios de una organización con sus emails
CREATE OR REPLACE FUNCTION public.get_organization_users(org_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  role organization_role,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    om.id,
    om.user_id,
    au.email,
    om.role,
    om.created_at,
    om.updated_at
  FROM organization_members om
  JOIN auth.users au ON om.user_id = au.id
  WHERE om.organization_id = org_id
  AND (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM organizations o 
      WHERE o.id = org_id 
      AND o.api_user_id = auth.uid()
    )
  );
$$;