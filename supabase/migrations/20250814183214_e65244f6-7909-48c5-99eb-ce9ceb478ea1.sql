-- Actualizar la función get_plan_limits para incluir todos los límites actualizados
CREATE OR REPLACE FUNCTION public.get_plan_limits(plan subscription_plan)
RETURNS TABLE(excel_limit integer, client_user_limit integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    CASE plan
      WHEN 'api_base' THEN 100
      WHEN 'api_pro' THEN 500
      WHEN 'client_base' THEN 100
      WHEN 'client_pro' THEN 500
      WHEN 'custom' THEN 1000  -- Valor por defecto para custom, se puede editar
    END as excel_limit,
    CASE plan
      WHEN 'api_base' THEN 1
      WHEN 'api_pro' THEN 1
      WHEN 'client_base' THEN 2
      WHEN 'client_pro' THEN 5
      WHEN 'custom' THEN 10     -- Valor por defecto para custom, se puede editar
    END as client_user_limit;
$function$;

-- Crear trigger para actualizar límites automáticamente cuando cambia el plan
CREATE OR REPLACE FUNCTION public.update_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  new_limits RECORD;
BEGIN
  -- Solo actualizar si cambió el plan y no es custom
  IF NEW.subscription_plan != OLD.subscription_plan AND NEW.subscription_plan != 'custom' THEN
    SELECT * INTO new_limits FROM get_plan_limits(NEW.subscription_plan);
    NEW.excel_limit = new_limits.excel_limit;
    NEW.client_user_limit = new_limits.client_user_limit;
    -- Resetear extras cuando cambia de plan (excepto custom)
    NEW.excel_extra = 0;
    NEW.client_user_extra = 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS update_organization_limits ON organizations;
CREATE TRIGGER update_organization_limits
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_limits();