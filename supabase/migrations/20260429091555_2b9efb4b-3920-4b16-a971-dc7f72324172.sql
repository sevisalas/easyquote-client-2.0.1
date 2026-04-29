
-- 1) sales_orders: drop overly broad UPDATE/DELETE policies
DROP POLICY IF EXISTS "Users can delete sales orders in their organization" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can update sales orders in their organization" ON public.sales_orders;

-- Replace with owner-only policies (admin/gestor/owner already covered by other policies)
CREATE POLICY "Owners can update their sales orders"
ON public.sales_orders
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete their sales orders"
ON public.sales_orders
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 2) user_roles: explicit deny for client-side writes (service role bypasses RLS)
CREATE POLICY "No client inserts on user_roles"
ON public.user_roles
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "No client updates on user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "No client deletes on user_roles"
ON public.user_roles
FOR DELETE
TO authenticated, anon
USING (false);
