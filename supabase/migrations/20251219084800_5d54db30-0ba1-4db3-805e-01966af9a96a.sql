-- Fix: When called with service role, get_organization_easyquote_credentials should
-- find credentials for the specified user without requiring them to be an owner.
-- The issue is that is_superadmin() uses auth.uid() which returns NULL with service role.

CREATE OR REPLACE FUNCTION public.get_organization_easyquote_credentials(p_user_id uuid)
 RETURNS TABLE(id uuid, api_username text, api_password text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_is_owner boolean := false;
  v_calling_user uuid;
BEGIN
  -- Get the calling user (will be NULL when called via service role)
  v_calling_user := auth.uid();
  
  -- Check if the user is an organization owner
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE api_user_id = p_user_id
  ) INTO v_is_owner;
  
  -- Authorization check:
  -- 1. Service role (v_calling_user IS NULL) - always allowed (edge functions)
  -- 2. User is an organization owner
  -- 3. User is a superadmin
  IF v_calling_user IS NOT NULL AND NOT v_is_owner AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: Credentials can only be accessed by organization owners';
  END IF;
  
  -- If user is an owner, get their own credentials
  SELECT api_user_id INTO v_owner_id
  FROM public.organizations
  WHERE api_user_id = p_user_id
  LIMIT 1;
  
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
  
  -- For non-owners (superadmins or service role):
  -- Find credentials through organization membership
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
  JOIN public.organizations o ON o.api_user_id = c.user_id
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = p_user_id
  LIMIT 1;
END;
$function$;