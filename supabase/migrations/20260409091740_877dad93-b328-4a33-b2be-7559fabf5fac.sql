
-- Fix create_organization_api_credential - remove references to dropped plaintext columns
CREATE OR REPLACE FUNCTION public.create_organization_api_credential(p_organization_id uuid, p_api_key text, p_api_secret text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  credential_id UUID;
BEGIN
  -- Verify the user is the organization owner
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = p_organization_id 
    AND api_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: Only organization owners can create API credentials';
  END IF;
  
  -- Validate inputs
  IF p_api_key IS NULL OR p_api_key = '' THEN
    RAISE EXCEPTION 'API key cannot be empty';
  END IF;
  
  IF p_api_secret IS NULL OR p_api_secret = '' THEN
    RAISE EXCEPTION 'API secret cannot be empty';
  END IF;

  INSERT INTO public.organization_api_credentials (
    organization_id,
    api_key_encrypted,
    api_secret_encrypted,
    created_by
  ) VALUES (
    p_organization_id,
    encrypt_credential(p_api_key),
    encrypt_credential(p_api_secret),
    auth.uid()
  )
  RETURNING id INTO credential_id;
  
  RETURN credential_id;
END;
$function$;

-- Fix get_organization_api_credentials - remove plaintext fallback
CREATE OR REPLACE FUNCTION public.get_organization_api_credentials(p_organization_id uuid)
 RETURNS TABLE(id uuid, api_key text, api_secret text, usage_count integer, last_used_at timestamp with time zone, is_active boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify the user is the organization owner
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE organizations.id = p_organization_id 
    AND organizations.api_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: Only organization owners can access API credentials';
  END IF;
  
  RETURN QUERY
  SELECT 
    cred.id,
    decrypt_credential(cred.api_key_encrypted) as api_key,
    decrypt_credential(cred.api_secret_encrypted) as api_secret,
    cred.usage_count,
    cred.last_used_at,
    cred.is_active,
    cred.created_at
  FROM public.organization_api_credentials cred
  WHERE cred.organization_id = p_organization_id
  AND cred.is_active = true;
END;
$function$;
