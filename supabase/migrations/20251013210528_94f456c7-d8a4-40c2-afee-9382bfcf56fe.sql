-- Add configuration field to organization_integration_access for storing endpoint and other settings
ALTER TABLE organization_integration_access 
ADD COLUMN IF NOT EXISTS configuration jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN organization_integration_access.configuration IS 'Stores integration-specific configuration like WooCommerce endpoint URL';