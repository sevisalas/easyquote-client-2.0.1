
-- 1) quotes SELECT: comercial restricted to own quotes
DROP POLICY IF EXISTS "Users can view accessible quotes" ON public.quotes;
CREATE POLICY "Users can view accessible quotes"
ON public.quotes
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = quotes.organization_id
      AND om.role = ANY (ARRAY['admin'::text, 'gestor'::text])
  )
  OR (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = quotes.organization_id
        AND om.role = 'comercial'::text
    ) AND quotes.user_id = auth.uid()
  )
  OR is_superadmin()
);

-- 2) sales_orders UPDATE: exclude operador
DROP POLICY IF EXISTS "Owners can update their sales orders" ON public.sales_orders;
CREATE POLICY "Owners can update their sales orders"
ON public.sales_orders
FOR UPDATE
USING (user_id = auth.uid() AND NOT has_role(auth.uid(), 'operador'::app_role))
WITH CHECK (user_id = auth.uid() AND NOT has_role(auth.uid(), 'operador'::app_role));

-- 3) sales_orders DELETE: exclude operador
DROP POLICY IF EXISTS "Owners can delete their sales orders" ON public.sales_orders;
CREATE POLICY "Owners can delete their sales orders"
ON public.sales_orders
FOR DELETE
USING (user_id = auth.uid() AND NOT has_role(auth.uid(), 'operador'::app_role));

-- 4) sales_order_items UPDATE: exclude operador
DROP POLICY IF EXISTS "Users can update organization sales order items" ON public.sales_order_items;
CREATE POLICY "Users can update organization sales order items"
ON public.sales_order_items
FOR UPDATE
USING (
  NOT has_role(auth.uid(), 'operador'::app_role)
  AND EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_items.sales_order_id
      AND (
        so.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM organization_members om1
          JOIN organization_members om2 ON om1.organization_id = om2.organization_id
          WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
        )
      )
  )
);

-- 5) sales_order_items DELETE: also exclude operador (defense in depth)
DROP POLICY IF EXISTS "Users can delete sales order items from organization orders" ON public.sales_order_items;
CREATE POLICY "Users can delete sales order items from organization orders"
ON public.sales_order_items
FOR DELETE
USING (
  NOT has_role(auth.uid(), 'operador'::app_role)
  AND EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_items.sales_order_id
      AND (
        so.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM organization_members om1
          JOIN organization_members om2 ON om1.organization_id = om2.organization_id
          WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
        )
      )
  )
);

-- 6) sales_orders INSERT: only admins may attribute orders to other users
DROP POLICY IF EXISTS "Members can create sales orders in their organization" ON public.sales_orders;
CREATE POLICY "Members can create sales orders in their organization"
ON public.sales_orders
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
        AND om1.role = 'admin'::text
        AND om2.user_id = sales_orders.user_id
    )
  )
);
