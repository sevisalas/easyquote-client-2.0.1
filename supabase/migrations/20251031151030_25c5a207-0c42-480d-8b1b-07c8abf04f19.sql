-- Actualizar política SELECT de holded_contacts para incluir miembros de la organización
DROP POLICY IF EXISTS "Users can view their organization's Holded contacts" ON holded_contacts;

CREATE POLICY "Users can view their organization's Holded contacts"
ON holded_contacts
FOR SELECT
TO authenticated
USING (
  -- Owner de la organización puede ver los contactos
  organization_id IN (
    SELECT organizations.id
    FROM organizations
    WHERE organizations.api_user_id = auth.uid()
  )
  OR
  -- Miembros de la organización pueden ver los contactos
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);