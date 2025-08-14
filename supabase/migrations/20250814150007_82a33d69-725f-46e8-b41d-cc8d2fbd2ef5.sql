-- Actualizar las políticas RLS para que usen el nuevo superadmin email
DROP POLICY IF EXISTS "superadmin_all_access_orgs" ON organizations;
DROP POLICY IF EXISTS "superadmin_all_access_members" ON organization_members;

-- Recrear políticas con el email correcto del superadmin
CREATE POLICY "superadmin_all_access_orgs" 
ON organizations 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM auth.users 
  WHERE users.id = auth.uid() 
  AND users.email = 'vdp@tradsis.net'
));

CREATE POLICY "superadmin_all_access_members" 
ON organization_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM auth.users 
  WHERE users.id = auth.uid() 
  AND users.email = 'vdp@tradsis.net'
));