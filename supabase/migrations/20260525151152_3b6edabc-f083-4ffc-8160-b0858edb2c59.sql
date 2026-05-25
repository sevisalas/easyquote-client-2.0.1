DROP POLICY IF EXISTS "Users can view organization customers" ON public.customers;
CREATE POLICY "Users can view organization customers"
ON public.customers
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR (organization_id IN (SELECT id FROM organizations WHERE api_user_id = auth.uid()))
  OR is_superadmin()
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = customers.organization_id
      AND om.role = ANY (ARRAY['admin','gestor','comercial','operador'])
  )
);