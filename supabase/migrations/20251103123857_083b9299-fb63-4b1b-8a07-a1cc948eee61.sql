-- Drop the restrictive policy
DROP POLICY IF EXISTS "Role based holded contacts view policy" ON public.holded_contacts;

-- Create policy that allows ALL organization members to view contacts
CREATE POLICY "Organization members can view holded contacts" 
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
  -- ALL organization members (including comerciales) can view contacts
  (EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = holded_contacts.organization_id
  ))
);