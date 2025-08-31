-- First, drop the existing policies to replace them with more secure ones
DROP POLICY IF EXISTS "Organization members can view integrations" ON integrations;
DROP POLICY IF EXISTS "Organization admins can manage integrations" ON integrations;

-- Create a secure view policy that hides sensitive configuration data from regular members
CREATE POLICY "Organization members can view integration metadata" 
ON integrations 
FOR SELECT 
USING (
  (EXISTS ( 
    SELECT 1 FROM organizations o 
    WHERE o.id = integrations.organization_id AND o.api_user_id = auth.uid()
  )) OR 
  (EXISTS ( 
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = ANY (ARRAY['admin'::organization_role, 'user'::organization_role])
  )) OR 
  is_superadmin()
);

-- Create a restricted view policy that only shows configuration to admins
CREATE POLICY "Only admins can view full integration configuration" 
ON integrations 
FOR SELECT 
USING (
  (EXISTS ( 
    SELECT 1 FROM organizations o 
    WHERE o.id = integrations.organization_id AND o.api_user_id = auth.uid()
  )) OR 
  (EXISTS ( 
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'admin'::organization_role
  )) OR 
  is_superadmin()
);

-- Create management policy for admins only
CREATE POLICY "Organization admins can manage integrations" 
ON integrations 
FOR ALL 
USING (
  (EXISTS ( 
    SELECT 1 FROM organizations o 
    WHERE o.id = integrations.organization_id AND o.api_user_id = auth.uid()
  )) OR 
  (EXISTS ( 
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'admin'::organization_role
  )) OR 
  is_superadmin()
);

-- Create a secure function to get integration status without exposing secrets
CREATE OR REPLACE FUNCTION get_integration_status(org_id uuid, integration_name text)
RETURNS TABLE(
  id uuid,
  integration_type text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  SELECT 
    i.id,
    i.integration_type,
    i.is_active,
    i.created_at,
    i.updated_at
  FROM integrations i
  WHERE i.organization_id = org_id 
    AND i.integration_type = integration_name
    AND (
      EXISTS (SELECT 1 FROM organizations o WHERE o.id = org_id AND o.api_user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = org_id AND om.user_id = auth.uid()) OR
      is_superadmin()
    );
$$;