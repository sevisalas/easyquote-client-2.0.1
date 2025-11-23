-- Quitar el constraint actual
ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- Actualizar todos los roles 'comercial' a 'gestor'
UPDATE public.organization_members 
SET role = 'gestor' 
WHERE role = 'comercial';

-- Añadir nuevo constraint con gestor
ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_check 
CHECK (role IN ('admin', 'gestor', 'operador'));