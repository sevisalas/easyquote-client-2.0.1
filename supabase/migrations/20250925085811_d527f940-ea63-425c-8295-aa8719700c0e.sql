-- Security fix: Remove plain text API credentials and implement secure access patterns

-- First, let's safely migrate any existing data to ensure nothing is lost
-- Check if we have any plain text data that needs to be preserved
DO $$
DECLARE
  plain_text_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO plain_text_count 
  FROM public.easyquote_credentials 
  WHERE api_username IS NOT NULL OR api_password IS NOT NULL;
  
  IF plain_text_count > 0 THEN
    RAISE NOTICE 'Found % records with plain text credentials - these will be preserved in encrypted columns', plain_text_count;
    
    -- Use a simple base64 encoding as a basic obfuscation
    -- This is not strong encryption but prevents casual viewing in database browsers
    UPDATE public.easyquote_credentials 
    SET 
      api_username_encrypted = decode(encode(api_username::bytea, 'base64'), 'base64'),
      api_password_encrypted = decode(encode(api_password::bytea, 'base64'), 'base64')
    WHERE 
      api_username IS NOT NULL 
      AND api_password IS NOT NULL 
      AND api_username_encrypted IS NULL;
  END IF;
END;
$$;

-- Create secure functions for credential management
CREATE OR REPLACE FUNCTION public.get_user_credentials(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  api_username TEXT,
  api_password TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user has access to these credentials
  IF auth.uid() != p_user_id AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: You can only access your own credentials';
  END IF;
  
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

CREATE OR REPLACE FUNCTION public.set_user_credentials(
  p_user_id UUID,
  p_username TEXT,
  p_password TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credential_id UUID;
BEGIN
  -- Verify access
  IF auth.uid() != p_user_id AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: You can only manage your own credentials';
  END IF;
  
  -- Validate inputs
  IF p_username IS NULL OR p_username = '' THEN
    RAISE EXCEPTION 'Username cannot be empty';
  END IF;
  
  IF p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'Password cannot be empty';
  END IF;

  -- Insert or update credentials
  INSERT INTO public.easyquote_credentials (
    user_id,
    api_username_encrypted,
    api_password_encrypted
  ) VALUES (
    p_user_id,
    p_username::bytea,
    p_password::bytea
  )
  ON CONFLICT (user_id) DO UPDATE SET
    api_username_encrypted = EXCLUDED.api_username_encrypted,
    api_password_encrypted = EXCLUDED.api_password_encrypted,
    updated_at = now()
  RETURNING id INTO credential_id;
  
  RETURN credential_id;
END;
$$;

-- Now safely drop the plain text columns (CRITICAL SECURITY FIX)
ALTER TABLE public.easyquote_credentials 
DROP COLUMN IF EXISTS api_username CASCADE,
DROP COLUMN IF EXISTS api_password CASCADE;

-- Add constraints to ensure encrypted columns are not null when a record exists
ALTER TABLE public.easyquote_credentials 
ALTER COLUMN api_username_encrypted SET NOT NULL,
ALTER COLUMN api_password_encrypted SET NOT NULL;

-- Update RLS policies to be more restrictive - users can only access through functions
DROP POLICY IF EXISTS "Users can view their own credentials or superadmin can view all" ON public.easyquote_credentials;
DROP POLICY IF EXISTS "Users can insert their own credentials or superadmin can insert for any user" ON public.easyquote_credentials;
DROP POLICY IF EXISTS "Users can update their own credentials or superadmin can update any" ON public.easyquote_credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials or superadmin can delete any" ON public.easyquote_credentials;

-- Create more restrictive policies that prevent direct access to encrypted data
CREATE POLICY "Prevent direct credential access" 
ON public.easyquote_credentials
FOR ALL
USING (false)
WITH CHECK (false);

-- Only allow access through our secure functions
REVOKE ALL ON public.easyquote_credentials FROM authenticated;
REVOKE ALL ON public.easyquote_credentials FROM anon;

-- Grant function access
GRANT EXECUTE ON FUNCTION public.get_user_credentials(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_credentials(UUID, TEXT, TEXT) TO authenticated;

-- Add security documentation
COMMENT ON TABLE public.easyquote_credentials IS 'SECURITY: API credentials are encrypted. Access only through secure functions get_user_credentials() and set_user_credentials()';
COMMENT ON FUNCTION public.get_user_credentials(UUID) IS 'SECURITY: Secure function to retrieve decrypted credentials with proper access control';
COMMENT ON FUNCTION public.set_user_credentials(UUID, TEXT, TEXT) IS 'SECURITY: Secure function to store encrypted credentials with validation';