
-- Actualizar la política RLS para permitir que los miembros vean su organización
DROP POLICY IF EXISTS "Users can view organizations based on role" ON organizations;

CREATE POLICY "Users can view organizations based on role"
ON organizations
FOR SELECT
TO public
USING (
  auth.uid() = api_user_id 
  OR is_superadmin()
  OR id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);
