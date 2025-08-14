-- Crear perfil para test1
INSERT INTO public.profiles (id, first_name, last_name)
VALUES ('6bd4dc32-7aad-4f6d-bc75-b8210ea620a9', 'Test1', 'User')
ON CONFLICT (id) DO NOTHING;

-- Habilitar registro público permitiendo a usuarios autenticados crear perfiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Permitir a usuarios autenticados crear organizaciones
DROP POLICY IF EXISTS "api_users_own_org" ON public.organizations;

CREATE POLICY "api_users_own_org" 
ON public.organizations 
FOR ALL 
USING (api_user_id = auth.uid() OR auth.uid() IS NOT NULL)
WITH CHECK (api_user_id = auth.uid());