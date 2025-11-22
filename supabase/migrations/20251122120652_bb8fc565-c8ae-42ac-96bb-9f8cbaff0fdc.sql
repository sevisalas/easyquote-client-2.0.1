-- Permitir que los miembros de una organización vean los perfiles de otros miembros
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view organization members profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() 
    AND om2.user_id = profiles.user_id
  )
);