-- Arreglar política de perfiles para que funcione correctamente
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Verificar que la organización sea visible para test1
DROP POLICY IF EXISTS "api_users_own_org" ON public.organizations;

CREATE POLICY "api_users_own_org" 
ON public.organizations 
FOR ALL 
USING (api_user_id = auth.uid())
WITH CHECK (api_user_id = auth.uid());

-- Arreglar política de miembros de organización
DROP POLICY IF EXISTS "members_view_own_membership" ON public.organization_members;

CREATE POLICY "members_view_own_membership" 
ON public.organization_members 
FOR SELECT 
USING (user_id = auth.uid());

-- Permitir a los administradores de org ver todos los miembros
DROP POLICY IF EXISTS "org_admins_manage_members" ON public.organization_members;

CREATE POLICY "org_admins_manage_members" 
ON public.organization_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM organizations o 
  WHERE o.id = organization_members.organization_id 
  AND o.api_user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations o 
  WHERE o.id = organization_members.organization_id 
  AND o.api_user_id = auth.uid()
));