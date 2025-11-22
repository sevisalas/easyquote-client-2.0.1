-- Eliminar las políticas actuales de quotes que causan problemas
DROP POLICY IF EXISTS "Admin can view all organization quotes" ON quotes;
DROP POLICY IF EXISTS "Members can view organization quotes" ON quotes;
DROP POLICY IF EXISTS "Organization owner can view quotes" ON quotes;
DROP POLICY IF EXISTS "Members can create own quotes" ON quotes;
DROP POLICY IF EXISTS "Admin can update organization quotes" ON quotes;
DROP POLICY IF EXISTS "Members can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Organization owner can update quotes" ON quotes;
DROP POLICY IF EXISTS "Admin can delete organization quotes" ON quotes;
DROP POLICY IF EXISTS "Members can delete own quotes" ON quotes;
DROP POLICY IF EXISTS "Organization owner can delete quotes" ON quotes;

-- POLÍTICAS DE SELECT (ver presupuestos)
-- Admin puede ver todos los presupuestos de la organización
CREATE POLICY "Admin can view all organization quotes"
ON quotes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om1.role = 'admin'
      AND om2.user_id = quotes.user_id
  )
);

-- Comercial y operador pueden ver todos los presupuestos de la organización
CREATE POLICY "Members can view organization quotes"
ON quotes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = quotes.user_id
  )
);

-- Owner puede ver todos los presupuestos de la organización
CREATE POLICY "Organization owner can view quotes"
ON quotes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organizations org
    JOIN organization_members om ON om.organization_id = org.id
    WHERE org.api_user_id = auth.uid()
      AND om.user_id = quotes.user_id
  )
);

-- POLÍTICAS DE INSERT (crear presupuestos)
-- Miembros pueden crear sus propios presupuestos
CREATE POLICY "Members can create own quotes"
ON quotes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- POLÍTICAS DE UPDATE (editar presupuestos)
-- Admin puede editar todos los presupuestos de la organización
CREATE POLICY "Admin can update organization quotes"
ON quotes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om1.role = 'admin'
      AND om2.user_id = quotes.user_id
  )
);

-- Miembros pueden editar sus propios presupuestos
CREATE POLICY "Members can update own quotes"
ON quotes FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- Owner puede editar todos los presupuestos de la organización
CREATE POLICY "Organization owner can update quotes"
ON quotes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organizations org
    JOIN organization_members om ON om.organization_id = org.id
    WHERE org.api_user_id = auth.uid()
      AND om.user_id = quotes.user_id
  )
);

-- POLÍTICAS DE DELETE (eliminar presupuestos)
-- Admin puede eliminar todos los presupuestos de la organización
CREATE POLICY "Admin can delete organization quotes"
ON quotes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om1.role = 'admin'
      AND om2.user_id = quotes.user_id
  )
);

-- Miembros pueden eliminar sus propios presupuestos
CREATE POLICY "Members can delete own quotes"
ON quotes FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- Owner puede eliminar todos los presupuestos de la organización
CREATE POLICY "Organization owner can delete quotes"
ON quotes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organizations org
    JOIN organization_members om ON om.organization_id = org.id
    WHERE org.api_user_id = auth.uid()
      AND om.user_id = quotes.user_id
  )
);