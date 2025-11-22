-- Función helper para verificar el rol del usuario actual
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TABLE(user_id uuid, role text, organization_id uuid, organization_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    om.user_id,
    om.role,
    om.organization_id,
    o.name as organization_name
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  WHERE om.user_id = auth.uid()
  LIMIT 1;
$$;