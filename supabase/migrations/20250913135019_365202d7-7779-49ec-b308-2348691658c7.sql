-- Fix the credential generation functions to use the correct PostgreSQL function
-- Replace gen_random_bytes with pgcrypto extension functions

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix the generate_api_key function
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT AS $$
BEGIN
  RETURN 'eq_' || encode(gen_random_uuid()::text::bytea, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix the generate_api_secret function  
CREATE OR REPLACE FUNCTION public.generate_api_secret()
RETURNS TEXT AS $$
BEGIN
  RETURN 'eqs_' || encode((gen_random_uuid()::text || gen_random_uuid()::text)::bytea, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;