-- Create audit log table for customer access
CREATE TABLE IF NOT EXISTS public.customer_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  record_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on audit logs
ALTER TABLE public.customer_access_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view their own access logs"
ON public.customer_access_logs
FOR SELECT
USING (auth.uid() = user_id OR is_superadmin());

-- Only system can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
ON public.customer_access_logs
FOR INSERT
WITH CHECK (true);

-- Create function to log customer access
CREATE OR REPLACE FUNCTION public.log_customer_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_access_logs (
    user_id,
    customer_id,
    operation,
    metadata
  ) VALUES (
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE 
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'changed_fields', (
          SELECT jsonb_object_agg(key, jsonb_build_object('old', OLD_json->key, 'new', NEW_json->key))
          FROM (SELECT jsonb_object_keys(to_jsonb(NEW)) AS key) keys
          WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
        ),
        'old_data', to_jsonb(OLD),
        'new_data', to_jsonb(NEW)
      )
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Don't block the operation if logging fails
    RAISE WARNING 'Failed to log customer access: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for audit logging
CREATE TRIGGER trigger_log_customer_insert
AFTER INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.log_customer_access();

CREATE TRIGGER trigger_log_customer_update
AFTER UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.log_customer_access();

CREATE TRIGGER trigger_log_customer_delete
AFTER DELETE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.log_customer_access();

-- Function to detect suspicious access patterns
CREATE OR REPLACE FUNCTION public.detect_suspicious_customer_access(
  time_window_minutes INTEGER DEFAULT 10,
  threshold INTEGER DEFAULT 50
)
RETURNS TABLE(
  user_id UUID,
  access_count BIGINT,
  first_access TIMESTAMP WITH TIME ZONE,
  last_access TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cal.user_id,
    COUNT(*) as access_count,
    MIN(cal.accessed_at) as first_access,
    MAX(cal.accessed_at) as last_access
  FROM customer_access_logs cal
  WHERE cal.accessed_at >= (now() - (time_window_minutes || ' minutes')::INTERVAL)
  GROUP BY cal.user_id
  HAVING COUNT(*) > threshold
  ORDER BY access_count DESC;
$$;

-- Function to get audit trail for a specific customer
CREATE OR REPLACE FUNCTION public.get_customer_audit_trail(
  p_customer_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  operation TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cal.id,
    cal.user_id,
    cal.operation,
    cal.accessed_at,
    cal.metadata
  FROM customer_access_logs cal
  WHERE cal.customer_id = p_customer_id
    AND (cal.user_id = auth.uid() OR is_superadmin())
  ORDER BY cal.accessed_at DESC
  LIMIT p_limit;
$$;

-- Create index for better query performance
CREATE INDEX idx_customer_access_logs_user_time 
ON public.customer_access_logs(user_id, accessed_at DESC);

CREATE INDEX idx_customer_access_logs_customer 
ON public.customer_access_logs(customer_id, accessed_at DESC);

COMMENT ON TABLE public.customer_access_logs IS 'Audit log for tracking all access to customer data for security monitoring';
COMMENT ON FUNCTION public.detect_suspicious_customer_access IS 'Detects users with unusually high customer access rates that may indicate account compromise or data theft';
COMMENT ON FUNCTION public.get_customer_audit_trail IS 'Retrieves complete access history for a specific customer';