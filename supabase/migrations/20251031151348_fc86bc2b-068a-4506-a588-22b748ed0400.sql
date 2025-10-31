-- Crear función para obtener credenciales de la organización (owner o propias)
CREATE OR REPLACE FUNCTION public.get_organization_easyquote_credentials(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  api_username text,
  api_password text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Primero verificar si el usuario es owner de una organización
  SELECT api_user_id INTO v_owner_id
  FROM public.organizations
  WHERE api_user_id = p_user_id
  LIMIT 1;
  
  -- Si es owner, usar sus propias credenciales
  IF v_owner_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      c.id,
      CASE 
        WHEN c.api_username_encrypted IS NOT NULL 
        THEN convert_from(c.api_username_encrypted, 'UTF8')
        ELSE NULL
      END as api_username,
      CASE 
        WHEN c.api_password_encrypted IS NOT NULL 
        THEN convert_from(c.api_password_encrypted, 'UTF8')
        ELSE NULL
      END as api_password,
      c.created_at,
      c.updated_at
    FROM public.easyquote_credentials c
    WHERE c.user_id = p_user_id;
    RETURN;
  END IF;
  
  -- Si no es owner, buscar si es miembro de alguna organización
  SELECT org.api_user_id INTO v_owner_id
  FROM public.organization_members om
  JOIN public.organizations org ON org.id = om.organization_id
  WHERE om.user_id = p_user_id
  LIMIT 1;
  
  -- Si es miembro, usar las credenciales del owner
  IF v_owner_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      c.id,
      CASE 
        WHEN c.api_username_encrypted IS NOT NULL 
        THEN convert_from(c.api_username_encrypted, 'UTF8')
        ELSE NULL
      END as api_username,
      CASE 
        WHEN c.api_password_encrypted IS NOT NULL 
        THEN convert_from(c.api_password_encrypted, 'UTF8')
        ELSE NULL
      END as api_password,
      c.created_at,
      c.updated_at
    FROM public.easyquote_credentials c
    WHERE c.user_id = v_owner_id;
    RETURN;
  END IF;
  
  -- Si no es ni owner ni miembro, usar sus propias credenciales (fallback)
  RETURN QUERY
  SELECT 
    c.id,
    CASE 
      WHEN c.api_username_encrypted IS NOT NULL 
      THEN convert_from(c.api_username_encrypted, 'UTF8')
      ELSE NULL
    END as api_username,
    CASE 
      WHEN c.api_password_encrypted IS NOT NULL 
      THEN convert_from(c.api_password_encrypted, 'UTF8')
      ELSE NULL
    END as api_password,
    c.created_at,
    c.updated_at
  FROM public.easyquote_credentials c
  WHERE c.user_id = p_user_id;
END;
$$;