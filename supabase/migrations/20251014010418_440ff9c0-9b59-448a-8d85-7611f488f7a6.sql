-- Fix ambiguous column reference in get_organization_api_credentials function
DROP FUNCTION IF EXISTS public.get_organization_api_credentials(uuid);

CREATE OR REPLACE FUNCTION public.get_organization_api_credentials(p_organization_id uuid)
RETURNS TABLE(
  id uuid,
  api_key text,
  api_secret text,
  usage_count integer,
  last_used_at timestamp with time zone,
  is_active boolean,
  created_at timestamp with time zone
)
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
    CASE 
      WHEN cred.api_key_encrypted IS NOT NULL 
      THEN decrypt_credential(cred.api_key_encrypted)
      ELSE cred.api_key
    END as api_key,
    CASE 
      WHEN cred.api_secret_encrypted IS NOT NULL 
      THEN decrypt_credential(cred.api_secret_encrypted)
      ELSE cred.api_secret
    END as api_secret,
    cred.usage_count,
    cred.last_used_at,
    cred.is_active,
    cred.created_at
  FROM public.organization_api_credentials cred
  WHERE cred.organization_id = p_organization_id
  AND cred.is_active = true;
END;
$function$;