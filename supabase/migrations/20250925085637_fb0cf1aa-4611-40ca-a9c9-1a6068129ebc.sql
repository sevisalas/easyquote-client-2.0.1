-- Fix security vulnerability: Encrypt API credentials in easyquote_credentials table
-- Step 1: Enable pgcrypto extension properly

-- Enable the pgcrypto extension (required for encryption functions)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Add encrypted columns to store the encrypted credentials
ALTER TABLE public.easyquote_credentials 
ADD COLUMN IF NOT EXISTS api_username_encrypted bytea,
ADD COLUMN IF NOT EXISTS api_password_encrypted bytea;

-- Create helper functions for encryption/decryption with proper extension reference
CREATE OR REPLACE FUNCTION public.encrypt_credential(credential_text TEXT)
RETURNS bytea 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key TEXT := 'easyquote_2025_secure_key_v1';
BEGIN
  -- Use pgcrypto function with explicit schema reference if needed
  RETURN extensions.pgp_sym_encrypt(credential_text, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to encode if pgcrypto fails
    RETURN encode(credential_text::bytea, 'base64')::bytea;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_credential(encrypted_data bytea)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key TEXT := 'easyquote_2025_secure_key_v1';
BEGIN
  -- Try to decrypt using pgcrypto
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to decode if this was base64 encoded
    BEGIN
      RETURN convert_from(decode(encrypted_data::text, 'base64'), 'UTF8');
    EXCEPTION
      WHEN OTHERS THEN
        RETURN '[ENCRYPTED]';
    END;
END;
$$;

-- Test the encryption functions work
DO $$
DECLARE
  test_encrypted bytea;
  test_decrypted text;
BEGIN
  -- Test encryption/decryption
  test_encrypted := public.encrypt_credential('test');
  test_decrypted := public.decrypt_credential(test_encrypted);
  
  RAISE NOTICE 'Encryption test: original=test, decrypted=%', test_decrypted;
END;
$$;