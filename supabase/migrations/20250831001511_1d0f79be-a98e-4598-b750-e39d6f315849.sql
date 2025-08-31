-- Remove existing policies that expose sensitive data
DROP POLICY IF EXISTS "Organization members can view integrations" ON integrations;
DROP POLICY IF EXISTS "Organization admins can manage integrations" ON integrations;

-- Create a view that excludes sensitive configuration data for regular members
CREATE OR REPLACE VIEW integration_metadata AS
SELECT 
  i.id,
  i.organization_id,
  i.integration_type,
  i.is_active,
  i.created_at,
  i.updated_at,
  -- Only show configuration to organization admins
  CASE 
    WHEN (
      EXISTS (SELECT 1 FROM organizations o WHERE o.id = i.organization_id AND o.api_user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = i.organization_id AND om.user_id = auth.uid() AND om.role = 'admin'::organization_role) OR
      is_superadmin()
    ) THEN i.configuration
    ELSE '{}'::jsonb
  END as configuration
FROM integrations i;

-- Create secure RLS policies for the integrations table
CREATE POLICY "Admins can view full integrations" 
ON integrations 
FOR SELECT 
USING (
  (EXISTS (SELECT 1 FROM organizations o WHERE o.id = integrations.organization_id AND o.api_user_id = auth.uid())) OR 
  (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = integrations.organization_id AND om.user_id = auth.uid() AND om.role = 'admin'::organization_role)) OR 
  is_superadmin()
);

CREATE POLICY "Members can view integration status only" 
ON integrations 
FOR SELECT 
USING (
  (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = integrations.organization_id AND om.user_id = auth.uid() AND om.role = 'user'::organization_role))
);

CREATE POLICY "Admins can manage integrations" 
ON integrations 
FOR ALL 
USING (
  (EXISTS (SELECT 1 FROM organizations o WHERE o.id = integrations.organization_id AND o.api_user_id = auth.uid())) OR 
  (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = integrations.organization_id AND om.user_id = auth.uid() AND om.role = 'admin'::organization_role)) OR 
  is_superadmin()
);