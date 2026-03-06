-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create their own sales orders" ON public.sales_orders;

-- Create a new INSERT policy that allows:
-- 1. Users inserting their own orders
-- 2. Admin/gestor inserting orders for users in their organization
CREATE POLICY "Members can create sales orders in their organization"
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om1.role IN ('admin', 'gestor')
      AND om2.user_id = sales_orders.user_id
  )
);