-- CRITICAL SECURITY FIX: Restrict quotes visibility to same organization only

-- Drop existing SELECT policy for quotes
DROP POLICY IF EXISTS "Users can view accessible quotes" ON public.quotes;

-- Create new SELECT policy that restricts to same organization
CREATE POLICY "Users can view accessible quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  -- Own quotes
  auth.uid() = user_id
  OR
  -- Quotes from users in the same organization
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = quotes.user_id
  )
);

-- Apply same fix to sales_orders
DROP POLICY IF EXISTS "Users can view accessible sales orders" ON public.sales_orders;

CREATE POLICY "Users can view accessible sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  -- Own orders
  auth.uid() = user_id
  OR
  -- Orders from users in the same organization
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = sales_orders.user_id
  )
);