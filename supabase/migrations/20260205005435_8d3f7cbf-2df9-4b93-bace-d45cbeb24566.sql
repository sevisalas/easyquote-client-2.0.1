-- Drop and recreate the function to accept the calling user_id for superadmin verification
CREATE OR REPLACE FUNCTION public.get_organization_easyquote_credentials_for_superadmin(
  p_organization_id uuid,
  p_calling_user_id uuid DEFAULT NULL
)
 RETURNS TABLE(api_username text, api_password text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
BEGIN
  -- Use provided user_id or fall back to auth.uid()
  v_caller_id := COALESCE(p_calling_user_id, auth.uid());
  
  -- Verify that the caller is a superadmin
  IF NOT public.has_role(v_caller_id, 'superadmin') THEN
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
$function$;