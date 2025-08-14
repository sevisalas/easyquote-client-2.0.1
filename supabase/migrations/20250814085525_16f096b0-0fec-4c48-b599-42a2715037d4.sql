-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.get_plan_limits(plan subscription_plan)
RETURNS TABLE(excel_limit INTEGER, client_user_limit INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    CASE plan
      WHEN 'api_base' THEN 100
      WHEN 'api_pro' THEN 500
      WHEN 'client_base' THEN 100
      WHEN 'client_pro' THEN 500
      WHEN 'custom' THEN 1000
    END as excel_limit,
    CASE plan
      WHEN 'api_base' THEN 1
      WHEN 'api_pro' THEN 1
      WHEN 'client_base' THEN 2
      WHEN 'client_pro' THEN 5
      WHEN 'custom' THEN 10
    END as client_user_limit;
$$;