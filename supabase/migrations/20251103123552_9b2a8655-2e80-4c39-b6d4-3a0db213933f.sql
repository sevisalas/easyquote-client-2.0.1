-- Drop the current SELECT policy for holded_contacts
DROP POLICY IF EXISTS "Users can view their organization's Holded contacts" ON public.holded_contacts;

-- Create new role-based policy for holded_contacts
CREATE POLICY "Role based holded contacts view policy" 
ON public.holded_contacts 
FOR SELECT 
USING (
  -- Organization owners can view all contacts
  (organization_id IN (
    SELECT organizations.id
    FROM organizations
    WHERE organizations.api_user_id = auth.uid()
  ))
  OR
  -- Organization admins can view all contacts in their organization
  (EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.role = 'admin'
      AND om.organization_id = holded_contacts.organization_id
  ))
);