-- Fix remaining functions with search path issues
CREATE OR REPLACE FUNCTION public.update_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log access to sensitive customer data
  INSERT INTO public.audit_log (
    table_name,
    operation,
    user_id,
    record_id,
    timestamp
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;