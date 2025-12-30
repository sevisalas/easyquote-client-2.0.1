-- Drop the existing check constraint and add a new one with 'erp' included
ALTER TABLE public.organizations 
DROP CONSTRAINT organizations_subscription_plan_check;

ALTER TABLE public.organizations 
ADD CONSTRAINT organizations_subscription_plan_check 
CHECK (subscription_plan = ANY (ARRAY['api_base'::text, 'api_pro'::text, 'client_base'::text, 'client_pro'::text, 'manager'::text, 'erp'::text, 'custom'::text]));