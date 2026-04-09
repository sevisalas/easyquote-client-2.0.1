
-- 1. Fix product-images storage SELECT policy
DROP POLICY IF EXISTS "Users can view product images" ON storage.objects;

CREATE POLICY "Authenticated users can view product images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Drop plaintext API credential columns (all rows already use encrypted)
ALTER TABLE public.organization_api_credentials DROP COLUMN IF EXISTS api_key;
ALTER TABLE public.organization_api_credentials DROP COLUMN IF EXISTS api_secret;

-- 3. Update validate_api_key to remove plaintext fallback
CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id uuid;
BEGIN
  -- Find a matching organization by decrypting the stored API keys
  SELECT organization_id INTO v_organization_id
  FROM public.organization_api_credentials
  WHERE is_active = true
    AND api_key_encrypted IS NOT NULL 
    AND decrypt_credential(api_key_encrypted) = p_api_key
  LIMIT 1;
  
  RETURN v_organization_id;
END;
$function$;
