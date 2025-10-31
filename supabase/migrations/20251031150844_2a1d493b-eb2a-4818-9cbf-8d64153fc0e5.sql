-- Arreglar política SELECT de customers para incluir clientes del owner
DROP POLICY IF EXISTS "Users can view organization customers" ON customers;

CREATE POLICY "Users can view organization customers"
ON customers
FOR SELECT
TO authenticated
USING (
  -- Ver sus propios clientes
  auth.uid() = user_id 
  OR
  -- Ver clientes de otros miembros de su organización
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om2.user_id = customers.user_id
  )
  OR
  -- Ver clientes creados por el owner de su organización
  EXISTS (
    SELECT 1 FROM organization_members om
    JOIN organizations org ON org.id = om.organization_id
    WHERE om.user_id = auth.uid()
    AND org.api_user_id = customers.user_id
  )
);