-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION get_integration_status_safe(org_id uuid)
RETURNS TABLE(
  id uuid,
  integration_type text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  has_configuration boolean
) 
LANGUAGE sql 
SECURITY DEFINER 
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    i.id,
    i.integration_type,
    i.is_active,
    i.created_at,
    i.updated_at,
    (i.configuration != '{}'::jsonb) as has_configuration
  FROM integrations i
  WHERE i.organization_id = org_id 
    AND (
      EXISTS (SELECT 1 FROM organizations o WHERE o.id = org_id AND o.api_user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = org_id AND om.user_id = auth.uid()) OR
      is_superadmin()
    );
$$;