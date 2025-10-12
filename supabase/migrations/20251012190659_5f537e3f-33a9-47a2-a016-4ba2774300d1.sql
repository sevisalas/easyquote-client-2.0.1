-- Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superadmins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superadmins can insert roles" ON public.user_roles;

-- Crear política simple para que los usuarios vean sus propios roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Crear política para superadmins usando la función security definer
-- Esto evita la recursión porque la función has_role ya tiene SECURITY DEFINER
CREATE POLICY "Superadmins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));