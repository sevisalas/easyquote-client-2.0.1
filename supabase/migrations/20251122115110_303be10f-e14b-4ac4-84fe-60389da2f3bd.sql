-- Drop existing policy
DROP POLICY IF EXISTS "Users can view accessible orders" ON sales_orders;

-- Create new policy that allows comerciales to see all orders
CREATE POLICY "Users can view accessible orders"
ON sales_orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'comercial') OR
  EXISTS (
    SELECT 1 FROM organization_members om1
    WHERE om1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = om1.organization_id
      AND om2.user_id = sales_orders.user_id
    )
  )
);