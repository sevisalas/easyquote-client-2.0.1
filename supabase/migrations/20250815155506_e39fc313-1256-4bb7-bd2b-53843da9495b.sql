-- Actualizar la función get_plan_limits con los límites correctos
CREATE OR REPLACE FUNCTION public.get_plan_limits(plan subscription_plan)
 RETURNS TABLE(excel_limit integer, client_user_limit integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    CASE plan
      WHEN 'api_base' THEN 100
      WHEN 'api_pro' THEN 500
      WHEN 'client_base' THEN 20     -- Corregido de 100 a 20
      WHEN 'client_pro' THEN 100     -- Corregido de 500 a 100
      WHEN 'custom' THEN 1000
    END as excel_limit,
    CASE plan
      WHEN 'api_base' THEN 1
      WHEN 'api_pro' THEN 1
      WHEN 'client_base' THEN 2
      WHEN 'client_pro' THEN 5
      WHEN 'custom' THEN 10
    END as client_user_limit;
$function$;

-- Actualizar las organizaciones existentes para que coincidan con los nuevos límites
UPDATE organizations 
SET 
  excel_limit = (SELECT excel_limit FROM get_plan_limits(subscription_plan)),
  client_user_limit = (SELECT client_user_limit FROM get_plan_limits(subscription_plan))
WHERE subscription_plan != 'custom';  -- No tocar los planes custom que pueden tener límites personalizados