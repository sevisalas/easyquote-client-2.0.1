-- Primero eliminar la política problemática con recursión
DROP POLICY IF EXISTS "Superadmins can manage all roles" ON public.user_roles;

-- Crear una nueva política para superadmins que use la función security definer
CREATE POLICY "Superadmins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));