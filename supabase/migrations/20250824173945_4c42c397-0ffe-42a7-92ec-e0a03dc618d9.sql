-- Fix remaining security issues from the linter

-- 1. Fix the audit log function to have proper search_path
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
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
$$;

-- 2. Remove the security definer view and replace with a secure function approach
DROP VIEW IF EXISTS public.customer_public_info;

-- Create a secure function to get public customer info instead of a view
CREATE OR REPLACE FUNCTION public.get_customer_public_info(customer_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  name text,
  user_id uuid,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id,
    c.name,
    c.user_id,
    c.created_at
  FROM public.customers c
  WHERE 
    c.user_id = auth.uid() 
    AND (customer_id IS NULL OR c.id = customer_id);
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_customer_public_info(uuid) TO authenticated;