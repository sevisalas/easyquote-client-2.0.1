-- Drop the current SELECT policy for customers
DROP POLICY IF EXISTS "Users can view organization customers" ON public.customers;

-- Create new policy that restricts view based on role
CREATE POLICY "Users can view customers based on role" 
ON public.customers 
FOR SELECT 
USING (
  -- Users can view their own customers
  (auth.uid() = user_id)
  OR
  -- Organization admins can view all customers in their organization
  (EXISTS (
    SELECT 1
    FROM organization_members om1
    WHERE om1.user_id = auth.uid()
      AND om1.role = 'admin'
      AND EXISTS (
        SELECT 1
        FROM organization_members om2
        WHERE om2.organization_id = om1.organization_id
          AND om2.user_id = customers.user_id
      )
  ))
  OR
  -- Organization owners (api_user) can view all customers
  (EXISTS (
    SELECT 1
    FROM organizations org
    JOIN organization_members om ON om.organization_id = org.id
    WHERE org.api_user_id = auth.uid()
      AND om.user_id = customers.user_id
  ))
);