-- RPC para que SuperAdmin pueda obtener credenciales de cualquier organización (impersonación)
-- Las credenciales se usan server-side en easyquote-refresh-token, NUNCA expuestas al frontend

CREATE OR REPLACE FUNCTION public.get_organization_easyquote_credentials_for_superadmin(
  p_organization_id uuid
)
RETURNS TABLE(api_username text, api_password text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar que el usuario actual es superadmin
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo superadmins pueden usar esta función';
  END IF;

  RETURN QUERY
  SELECT 
    CASE 
      WHEN c.api_username_encrypted IS NOT NULL 
      THEN convert_from(c.api_username_encrypted, 'UTF8')
      ELSE NULL
    END as api_username,
    CASE 
      WHEN c.api_password_encrypted IS NOT NULL 
      THEN convert_from(c.api_password_encrypted, 'UTF8')
      ELSE NULL
    END as api_password
  FROM easyquote_credentials c
  JOIN organizations o ON o.api_user_id = c.user_id
  WHERE o.id = p_organization_id
  LIMIT 1;
END;
$$;