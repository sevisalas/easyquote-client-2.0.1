
-- Crear función security definer para verificar membresía de organización
CREATE OR REPLACE FUNCTION public.is_organization_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Actualizar la política RLS usando la función
DROP POLICY IF EXISTS "Users can view organizations based on role" ON organizations;

CREATE POLICY "Users can view organizations based on role"
ON organizations
FOR SELECT
TO public
USING (
  auth.uid() = api_user_id 
  OR is_superadmin()
  OR is_organization_member(auth.uid(), id)
);
