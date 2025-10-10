-- Seguridad: Encriptar tokens de integración y eliminar credenciales en texto plano

-- 1. Añadir columnas encriptadas para tokens de integración
ALTER TABLE public.organization_integration_access 
ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea;

-- 2. Migrar datos existentes a formato encriptado
UPDATE public.organization_integration_access
SET 
  access_token_encrypted = access_token::bytea,
  refresh_token_encrypted = refresh_token::bytea
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

-- 3. Eliminar columnas de texto plano de tokens de integración
ALTER TABLE public.organization_integration_access 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

-- 4. Eliminar credenciales API en texto plano (ya existen versiones encriptadas)
ALTER TABLE public.organization_api_credentials
DROP COLUMN IF EXISTS api_key,
DROP COLUMN IF EXISTS api_secret;

-- 5. Comentarios para documentación
COMMENT ON COLUMN public.organization_integration_access.access_token_encrypted IS 'Encrypted access token for third-party integrations';
COMMENT ON COLUMN public.organization_integration_access.refresh_token_encrypted IS 'Encrypted refresh token for third-party integrations';
COMMENT ON COLUMN public.organization_api_credentials.api_key_encrypted IS 'Encrypted API key for authentication';
COMMENT ON COLUMN public.organization_api_credentials.api_secret_encrypted IS 'Encrypted API secret for authentication';