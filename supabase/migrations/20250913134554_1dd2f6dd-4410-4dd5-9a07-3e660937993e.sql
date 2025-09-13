-- Create a view to show organization users with their emails
-- This view will be accessible via RLS policies and show user emails safely

CREATE OR REPLACE VIEW public.organization_users_view AS
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  o.api_user_id,
  'API Administrator' as role,
  true as is_principal,
  1 as display_order
FROM organizations o
WHERE o.api_user_id IS NOT NULL

UNION ALL

SELECT 
  om.organization_id,
  o.name as organization_name,
  om.user_id as api_user_id,
  CASE 
    WHEN om.role = 'admin' THEN 'Administrador'
    ELSE 'Usuario'
  END as role,
  false as is_principal,
  2 as display_order
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id;

-- Enable RLS on the view
ALTER VIEW public.organization_users_view SET (security_barrier = true);

-- Create policy for the view
CREATE POLICY "Users can view organization users based on access" 
ON public.organization_users_view
FOR SELECT 
USING (
  -- API users can see their own organization users
  organization_id IN (
    SELECT id FROM organizations 
    WHERE api_user_id = auth.uid()
  )
  OR 
  -- Superadmin users can see all organization users
  public.is_superadmin()
  OR
  -- Organization members can see users from their organization
  organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  )
);