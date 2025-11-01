-- Clean up all existing policies for quotes
DROP POLICY IF EXISTS "Users can manage own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Organization owners can manage quotes" ON public.quotes;
DROP POLICY IF EXISTS "Organization admins can manage quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin can manage all organization quotes" ON public.quotes;
DROP POLICY IF EXISTS "Comercial can manage own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Operador can view organization quotes" ON public.quotes;

-- Admin: Can approve any quote in organization
CREATE POLICY "Admin can manage all organization quotes"
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

-- Comercial: Can only approve their own quotes
CREATE POLICY "Comercial can manage own quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'comercial'
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'comercial'
  )
);

-- Operador: Can only VIEW quotes
CREATE POLICY "Operador can view organization quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role = 'operador'
    AND om2.user_id = quotes.user_id
  )
);

-- Organization owners can manage all quotes
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

-- Clean up all existing policies for sales_orders
DROP POLICY IF EXISTS "Users can view own sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can create own sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Organization owners can manage sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Organization admins can manage sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Admin can manage all organization sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Comercial can view sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Comercial can create sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Operador can manage organization sales orders" ON public.sales_orders;

-- Admin: Can manage all sales orders
CREATE POLICY "Admin can manage all organization sales orders"
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

-- Comercial: Can only VIEW sales orders status
CREATE POLICY "Comercial can view sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role = 'comercial'
    AND om2.user_id = sales_orders.user_id
  )
);

-- Comercial: Can create sales orders (when approving quotes)
CREATE POLICY "Comercial can create sales orders"
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'comercial'
  )
);

-- Operador: Can manage/edit all organization sales orders
CREATE POLICY "Operador can manage organization sales orders"
ON public.sales_orders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role = 'operador'
    AND om2.user_id = sales_orders.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role = 'operador'
  )
);

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