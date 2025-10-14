-- Add api_key and api_secret columns to organization_api_credentials
ALTER TABLE public.organization_api_credentials 
ADD COLUMN IF NOT EXISTS api_key TEXT,
ADD COLUMN IF NOT EXISTS api_secret TEXT;