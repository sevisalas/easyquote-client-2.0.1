-- Paso 1: Eliminar el constraint viejo
ALTER TABLE organization_members 
DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- Paso 2: Actualizar los datos (usuarios con rol 'user' → 'comercial')
UPDATE organization_members 
SET role = 'comercial' 
WHERE role = 'user';

-- Paso 3: Crear el nuevo constraint
ALTER TABLE organization_members 
ADD CONSTRAINT organization_members_role_check 
CHECK (role IN ('admin', 'comercial', 'operador'));