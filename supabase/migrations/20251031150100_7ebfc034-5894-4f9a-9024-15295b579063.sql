-- Actualizar políticas RLS de customers para permitir acceso compartido en organización
DROP POLICY IF EXISTS "Users can view their own customers" ON customers;
DROP POLICY IF EXISTS "Users can create their own customers" ON customers;
DROP POLICY IF EXISTS "Users can update their own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete their own customers" ON customers;

-- Política SELECT: Ver clientes propios o de su organización
CREATE POLICY "Users can view organization customers"
ON customers
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om2.user_id = customers.user_id
  )
);

-- Política INSERT: Solo admins pueden crear clientes
CREATE POLICY "Organization admins can create customers"
ON customers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.api_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = o.id
      AND om.user_id = auth.uid()
    )
  )
);

-- Política UPDATE: Solo admins pueden actualizar clientes
CREATE POLICY "Organization admins can update customers"
ON customers
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM organizations o
    JOIN organization_members om ON om.organization_id = o.id
    WHERE o.api_user_id = auth.uid()
    AND om.user_id = customers.user_id
  )
  OR EXISTS (
    SELECT 1 FROM organization_members om1
    WHERE om1.user_id = auth.uid()
    AND om1.role = 'admin'
    AND EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = om1.organization_id
      AND om2.user_id = customers.user_id
    )
  )
);

-- Política DELETE: Solo admins pueden eliminar clientes
CREATE POLICY "Organization admins can delete customers"
ON customers
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM organizations o
    JOIN organization_members om ON om.organization_id = o.id
    WHERE o.api_user_id = auth.uid()
    AND om.user_id = customers.user_id
  )
  OR EXISTS (
    SELECT 1 FROM organization_members om1
    WHERE om1.user_id = auth.uid()
    AND om1.role = 'admin'
    AND EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = om1.organization_id
      AND om2.user_id = customers.user_id
    )
  )
);

-- Actualizar políticas de pdf_configurations para restringir acceso solo a admins
DROP POLICY IF EXISTS "Users can view their own PDF configuration" ON pdf_configurations;
DROP POLICY IF EXISTS "Users can insert their own PDF configuration" ON pdf_configurations;
DROP POLICY IF EXISTS "Users can update their own PDF configuration" ON pdf_configurations;
DROP POLICY IF EXISTS "Users can delete their own PDF configuration" ON pdf_configurations;

-- Solo propietarios de organizaciones y superadmins pueden gestionar configuraciones PDF
CREATE POLICY "Organization owners can view PDF configurations"
ON pdf_configurations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR is_superadmin()
);

CREATE POLICY "Organization owners can insert PDF configurations"
ON pdf_configurations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM organizations WHERE api_user_id = auth.uid())
    OR is_superadmin()
  )
);

CREATE POLICY "Organization owners can update PDF configurations"
ON pdf_configurations
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM organizations WHERE api_user_id = auth.uid())
    OR is_superadmin()
  )
);

CREATE POLICY "Organization owners can delete PDF configurations"
ON pdf_configurations
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM organizations WHERE api_user_id = auth.uid())
    OR is_superadmin()
  )
);