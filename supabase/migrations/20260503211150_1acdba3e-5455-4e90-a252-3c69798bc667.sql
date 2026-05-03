-- 1) sales_orders: restringir Operador a solo lectura
DROP POLICY IF EXISTS "Operador can manage organization sales orders" ON public.sales_orders;

CREATE POLICY "Operador can view organization sales orders"
ON public.sales_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om1.role = 'operador'
      AND om2.user_id = sales_orders.user_id
  )
);

-- 2) customers: excluir rol Operador del SELECT
DROP POLICY IF EXISTS "Users can view organization customers" ON public.customers;

CREATE POLICY "Users can view organization customers"
ON public.customers
FOR SELECT
USING (
  auth.uid() = user_id
  OR organization_id IN (
    SELECT organizations.id FROM organizations WHERE organizations.api_user_id = auth.uid()
  )
  OR is_superadmin()
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = customers.organization_id
      AND om.role IN ('admin', 'gestor', 'comercial')
  )
);