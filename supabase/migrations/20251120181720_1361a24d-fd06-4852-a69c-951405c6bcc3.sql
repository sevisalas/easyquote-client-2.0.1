-- Primero, actualizar usuarios existentes con rol 'user' a 'comercial'
UPDATE user_roles 
SET role = 'comercial' 
WHERE role = 'user';

-- Eliminar el rol 'user' del enum y mantener solo los roles correctos
ALTER TYPE app_role RENAME TO app_role_old;

CREATE TYPE app_role AS ENUM ('superadmin', 'admin', 'comercial', 'operador');

-- Actualizar la función has_role primero para que use el nuevo tipo
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role::text
  )
$$;

-- Actualizar la tabla user_roles para usar el nuevo enum
ALTER TABLE user_roles 
  ALTER COLUMN role TYPE app_role USING role::text::app_role;

-- Ahora eliminar el enum viejo con CASCADE
DROP TYPE app_role_old CASCADE;