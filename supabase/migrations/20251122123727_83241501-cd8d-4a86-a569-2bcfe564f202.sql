-- Fix RLS policies for sales_orders to allow comercial role to view all orders

-- Drop existing SELECT policy for sales_orders
DROP POLICY IF EXISTS "Users can view accessible sales orders" ON public.sales_orders;

-- Create new SELECT policy that includes comercial role
CREATE POLICY "Users can view accessible sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'comercial'::app_role)
  OR EXISTS (
    SELECT 1
    FROM organization_members om1
    WHERE om1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM organization_members om2
        WHERE om2.organization_id = om1.organization_id
          AND om2.user_id = sales_orders.user_id
      )
  )
);