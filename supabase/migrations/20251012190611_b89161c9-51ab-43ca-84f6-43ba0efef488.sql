-- Eliminar las políticas existentes
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superadmins can manage all roles" ON public.user_roles;

-- Crear política simple que permita a todos ver sus propios roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Crear política para superadmins que NO use has_role para evitar cualquier problema
CREATE POLICY "Superadmins can manage all roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'superadmin'
  )
);

-- Pero necesitamos una política INSERT que permita a los superadmins crear roles
-- sin causar recursión infinita en el WITH CHECK
CREATE POLICY "Superadmins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'superadmin'
  )
);