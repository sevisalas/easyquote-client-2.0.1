-- Add max_daily_orders configuration to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS max_daily_orders integer DEFAULT 20;

COMMENT ON COLUMN organizations.max_daily_orders IS 'Maximum number of orders that can be processed per day';
