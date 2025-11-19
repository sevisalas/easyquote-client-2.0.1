-- Add unique constraint for integration_id and organization_id
-- This allows upsert operations based on these fields
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_integration_org 
ON customers(integration_id, organization_id) 
WHERE integration_id IS NOT NULL AND organization_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_customers_integration_org IS 'Unique constraint for customers identified by integration_id within an organization. Used by webhooks to prevent duplicates.';
