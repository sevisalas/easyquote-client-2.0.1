-- Get current policies and drop them all
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'integrations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Create new secure policies that protect sensitive configuration data
-- Policy 1: Only organization admins can access full integration data including secrets
CREATE POLICY "Organization admins can manage and view integrations" 
ON integrations 
FOR ALL 
USING (
  (EXISTS (SELECT 1 FROM organizations o WHERE o.id = integrations.organization_id AND o.api_user_id = auth.uid())) OR 
  (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = integrations.organization_id AND om.user_id = auth.uid() AND om.role = 'admin'::organization_role)) OR 
  is_superadmin()
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM organizations o WHERE o.id = integrations.organization_id AND o.api_user_id = auth.uid())) OR 
  (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = integrations.organization_id AND om.user_id = auth.uid() AND om.role = 'admin'::organization_role)) OR 
  is_superadmin()
);

-- Create a secure function that returns integration status without exposing secrets
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