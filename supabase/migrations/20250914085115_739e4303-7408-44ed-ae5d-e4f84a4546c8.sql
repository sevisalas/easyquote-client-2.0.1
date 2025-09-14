-- Update RLS policies for organization_integration_access to allow superadmin access

-- Drop existing policies
DROP POLICY IF EXISTS "Organization owners can manage integration access" ON public.organization_integration_access;
DROP POLICY IF EXISTS "Organization owners can update integration access" ON public.organization_integration_access;
DROP POLICY IF EXISTS "Organization owners can delete integration access" ON public.organization_integration_access;
DROP POLICY IF EXISTS "Organization members can view integration access" ON public.organization_integration_access;

-- Create new policies that include superadmin permissions
CREATE POLICY "Organization owners and superadmins can manage integration access" 
ON public.organization_integration_access 
FOR INSERT 
WITH CHECK (
  (auth.uid() IN ( SELECT organizations.api_user_id
   FROM organizations
  WHERE (organizations.id = organization_integration_access.organization_id))) 
  OR is_superadmin()
);

CREATE POLICY "Organization owners and superadmins can update integration access" 
ON public.organization_integration_access 
FOR UPDATE 
USING (
  (auth.uid() IN ( SELECT organizations.api_user_id
   FROM organizations
  WHERE (organizations.id = organization_integration_access.organization_id))) 
  OR is_superadmin()
);

CREATE POLICY "Organization owners and superadmins can delete integration access" 
ON public.organization_integration_access 
FOR DELETE 
USING (
  (auth.uid() IN ( SELECT organizations.api_user_id
   FROM organizations
  WHERE (organizations.id = organization_integration_access.organization_id))) 
  OR is_superadmin()
);

CREATE POLICY "Organization members and superadmins can view integration access" 
ON public.organization_integration_access 
FOR SELECT 
USING (
  ((auth.uid() IN ( SELECT organizations.api_user_id
   FROM organizations
  WHERE (organizations.id = organization_integration_access.organization_id))) OR (auth.uid() IN ( SELECT organization_members.user_id
   FROM organization_members
  WHERE (organization_members.organization_id = organization_integration_access.organization_id))))
  OR is_superadmin()
);