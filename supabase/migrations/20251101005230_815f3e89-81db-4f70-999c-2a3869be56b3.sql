-- Crear política para que superadmins puedan actualizar cualquier organización
CREATE POLICY "Superadmins can update any organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());