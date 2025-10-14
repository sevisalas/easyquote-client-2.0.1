-- Create function to validate API key and return organization ID
CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id uuid;
BEGIN
  -- Try to find a matching organization by decrypting the stored API keys
  SELECT organization_id INTO v_organization_id
  FROM public.organization_api_credentials
  WHERE is_active = true
    AND (
      -- Check if the decrypted key matches
      (api_key_encrypted IS NOT NULL AND decrypt_credential(api_key_encrypted) = p_api_key)
      OR
      -- Fallback to plain text comparison (legacy support)
      (api_key IS NOT NULL AND api_key != '[ENCRYPTED]' AND api_key = p_api_key)
    )
  LIMIT 1;
  
  RETURN v_organization_id;
END;
$function$;