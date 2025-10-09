-- Step 1: Add encrypted columns for API credentials
ALTER TABLE public.organization_api_credentials 
ADD COLUMN IF NOT EXISTS api_key_encrypted bytea,
ADD COLUMN IF NOT EXISTS api_secret_encrypted bytea;

-- Step 2: Migrate existing plain text credentials to encrypted format
-- Using the existing encrypt_credential function
UPDATE public.organization_api_credentials
SET 
  api_key_encrypted = encrypt_credential(api_key),
  api_secret_encrypted = encrypt_credential(api_secret)
WHERE api_key_encrypted IS NULL OR api_secret_encrypted IS NULL;

-- Step 3: Drop the overly permissive policy that allows all members to view credentials
DROP POLICY IF EXISTS "Organization members can view API credentials" ON public.organization_api_credentials;

-- Step 4: Create restrictive policy - only organization owners can view credentials
CREATE POLICY "Only organization owners can view API credentials"
ON public.organization_api_credentials
FOR SELECT
USING (
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE api_user_id = auth.uid()
  )
);

-- Step 5: Update other policies to be owner-only as well
DROP POLICY IF EXISTS "Organization owners can create API credentials" ON public.organization_api_credentials;
DROP POLICY IF EXISTS "Organization owners can update API credentials" ON public.organization_api_credentials;
DROP POLICY IF EXISTS "Organization owners can delete API credentials" ON public.organization_api_credentials;

CREATE POLICY "Organization owners can create API credentials"
ON public.organization_api_credentials
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update API credentials"
ON public.organization_api_credentials
FOR UPDATE
USING (
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can delete API credentials"
ON public.organization_api_credentials
FOR DELETE
USING (
  organization_id IN (
    SELECT id FROM public.organizations 
    WHERE api_user_id = auth.uid()
  )
);

-- Step 6: Create secure function to get decrypted API credentials (owner-only access)
CREATE OR REPLACE FUNCTION public.get_organization_api_credentials(p_organization_id UUID)
RETURNS TABLE(
  id UUID,
  api_key TEXT,
  api_secret TEXT,
  usage_count INTEGER,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user is the organization owner
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = p_organization_id 
    AND api_user_id = auth.uid()
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
$$;

-- Step 7: Create function to safely create encrypted API credentials
CREATE OR REPLACE FUNCTION public.create_organization_api_credential(
  p_organization_id UUID,
  p_api_key TEXT,
  p_api_secret TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    api_key,
    api_secret,
    created_by
  ) VALUES (
    p_organization_id,
    encrypt_credential(p_api_key),
    encrypt_credential(p_api_secret),
    '[ENCRYPTED]',
    '[ENCRYPTED]',
    auth.uid()
  )
  RETURNING id INTO credential_id;
  
  RETURN credential_id;
END;
$$;

-- Step 8: Obfuscate existing plain text credentials now that we have encrypted versions
UPDATE public.organization_api_credentials
SET 
  api_key = '[ENCRYPTED]',
  api_secret = '[ENCRYPTED]'
WHERE api_key_encrypted IS NOT NULL;

-- Step 9: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_org_api_creds_org_id 
ON public.organization_api_credentials(organization_id, is_active);

COMMENT ON COLUMN public.organization_api_credentials.api_key_encrypted IS 'Encrypted API key - use get_organization_api_credentials() function to retrieve';
COMMENT ON COLUMN public.organization_api_credentials.api_secret_encrypted IS 'Encrypted API secret - use get_organization_api_credentials() function to retrieve';
COMMENT ON FUNCTION public.get_organization_api_credentials IS 'Securely retrieves decrypted API credentials for organization owners only';
COMMENT ON FUNCTION public.create_organization_api_credential IS 'Securely creates encrypted API credentials for organization owners only';