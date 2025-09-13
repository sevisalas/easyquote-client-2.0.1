-- Modificar las políticas RLS de easyquote_credentials para permitir que superadmin gestione todas las credenciales

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view their own credentials" ON public.easyquote_credentials;
DROP POLICY IF EXISTS "Users can insert their own credentials" ON public.easyquote_credentials;
DROP POLICY IF EXISTS "Users can update their own credentials" ON public.easyquote_credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials" ON public.easyquote_credentials;

-- Crear nuevas políticas que permitan a superadmins gestionar todas las credenciales
CREATE POLICY "Users can view their own credentials or superadmin can view all" 
ON public.easyquote_credentials
FOR SELECT 
USING (
  auth.uid() = user_id OR public.is_superadmin()
);

CREATE POLICY "Users can insert their own credentials or superadmin can insert for any user" 
ON public.easyquote_credentials
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR public.is_superadmin()
);

CREATE POLICY "Users can update their own credentials or superadmin can update any" 
ON public.easyquote_credentials
FOR UPDATE 
USING (
  auth.uid() = user_id OR public.is_superadmin()
);

CREATE POLICY "Users can delete their own credentials or superadmin can delete any" 
ON public.easyquote_credentials
FOR DELETE 
USING (
  auth.uid() = user_id OR public.is_superadmin()
);