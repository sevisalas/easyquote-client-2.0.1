
-- First drop the existing check constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_subscription_plan_check;

-- Update the data BEFORE adding new constraint
UPDATE organizations 
SET subscription_plan = 'manager' 
WHERE subscription_plan = 'erp';

-- Now add new check constraint (without 'erp', with 'manager')
ALTER TABLE organizations ADD CONSTRAINT organizations_subscription_plan_check 
CHECK (subscription_plan IN ('api_base', 'api_pro', 'client_base', 'client_pro', 'manager', 'custom'));

-- Update plan_configurations
UPDATE plan_configurations 
SET plan_id = 'manager' 
WHERE plan_id = 'erp';
