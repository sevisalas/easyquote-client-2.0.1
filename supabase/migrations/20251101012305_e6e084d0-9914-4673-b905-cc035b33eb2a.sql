-- Update quotes policies to work with both role systems
DROP POLICY IF EXISTS "Comercial can manage own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin can manage all quotes" ON public.quotes;

-- Users can manage their own quotes (backwards compatible)
CREATE POLICY "Users can manage own quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Organization owners can manage all organization quotes
CREATE POLICY "Organization owners can manage quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organizations org
    WHERE org.api_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org.id
      AND om.user_id = quotes.user_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organizations org
    WHERE org.api_user_id = auth.uid()
  )
);

-- Organization admins can manage all organization quotes
CREATE POLICY "Organization admins can manage quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role = 'admin'
    AND om2.user_id = quotes.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'admin'
  )
);

-- Update sales_orders policies to work with both role systems
DROP POLICY IF EXISTS "Comercial can view sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Comercial can create sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Admin can manage sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Operador can view sales orders" ON public.sales_orders;

-- Users can view their own sales orders
CREATE POLICY "Users can view own sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own sales orders
CREATE POLICY "Users can create own sales orders"
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Organization owners can manage all sales orders
CREATE POLICY "Organization owners can manage sales orders"
ON public.sales_orders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organizations org
    WHERE org.api_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org.id
      AND om.user_id = sales_orders.user_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organizations org
    WHERE org.api_user_id = auth.uid()
  )
);

-- Organization admins can manage all organization sales orders
CREATE POLICY "Organization admins can manage sales orders"
ON public.sales_orders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role = 'admin'
    AND om2.user_id = sales_orders.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'admin'
  )
);