-- Remove prices from plan configurations since they were placeholder values
UPDATE public.plan_configurations 
SET price = NULL;