-- Añadir campos de nombre de usuario y cuenta asociada a organization_members
ALTER TABLE public.organization_members
ADD COLUMN display_name TEXT,
ADD COLUMN cuenta_holded TEXT;

-- Crear índice para búsquedas por cuenta_holded
CREATE INDEX idx_organization_members_cuenta_holded 
ON public.organization_members(cuenta_holded) 
WHERE cuenta_holded IS NOT NULL;

COMMENT ON COLUMN public.organization_members.display_name IS 'Nombre de usuario para mostrar en la interfaz';
COMMENT ON COLUMN public.organization_members.cuenta_holded IS 'ID de cuenta asociada en Holded (solo para clientes con integración)';