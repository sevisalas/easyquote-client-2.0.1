-- Restrict get_organization_easyquote_credentials to organization owners only
-- This adds an extra layer of security - even though the frontend now uses
-- the secure edge function, this prevents direct RPC access by non-owners

CREATE OR REPLACE FUNCTION public.get_organization_easyquote_credentials(p_user_id uuid)
 RETURNS TABLE(id uuid, api_username text, api_password text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_is_owner boolean := false;
BEGIN
  -- Check if the calling user is authorized:
  -- 1. Must be the same user requesting their own credentials, OR
  -- 2. Must be a superadmin
  -- Note: Service role (edge functions) bypasses this check via SECURITY DEFINER
  
  -- First, check if the user is an organization owner
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE api_user_id = p_user_id
  ) INTO v_is_owner;
  
  -- If not an owner, check if they're a superadmin
  IF NOT v_is_owner AND NOT public.is_superadmin() THEN
    -- For non-owners and non-superadmins, deny access
    -- The edge function (easyquote-refresh-token) should be used instead
    RAISE EXCEPTION 'Access denied: Credentials can only be accessed by organization owners';
  END IF;
  
  -- Original logic: Primero verificar si el usuario es owner de una organización
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
  
  -- If superadmin but not owner, still allow for p_user_id
  -- This handles edge function service role calls
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
$function$;