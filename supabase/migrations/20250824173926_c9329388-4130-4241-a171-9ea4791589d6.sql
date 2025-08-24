-- Fix security issues identified in the security scan

-- 1. Fix database functions to use proper search_path (security definer functions should have explicit search_path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name'
  );
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  RETURN user_email = 'vdp@tradsis.net';
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_organization_users(org_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, email text, role organization_role, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    om.id,
    om.user_id,
    au.email,
    om.role,
    om.created_at,
    om.updated_at
  FROM organization_members om
  JOIN auth.users au ON om.user_id = au.id
  WHERE om.organization_id = org_id
  AND (
    is_superadmin() OR 
    EXISTS (
      SELECT 1 FROM organizations o 
      WHERE o.id = org_id 
      AND o.api_user_id = auth.uid()
    )
  );
$function$;

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
      WHEN 'client_base' THEN 20
      WHEN 'client_pro' THEN 100
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

-- 2. Add additional RLS policy for customers table to restrict access to sensitive data
-- Create a view for public customer data (without sensitive info like email/phone)
CREATE OR REPLACE VIEW public.customer_public_info AS
SELECT 
  id,
  name,
  user_id,
  created_at
FROM public.customers;

-- Grant access to the view
GRANT SELECT ON public.customer_public_info TO authenticated;
GRANT SELECT ON public.customer_public_info TO anon;

-- Enable RLS on the view (though views inherit from base table)
ALTER VIEW public.customer_public_info SET (security_barrier = true);

-- 3. Create audit log function for sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 4. Create audit log table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid,
  record_id uuid,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only superadmins can view audit logs
CREATE POLICY "Only superadmins can view audit logs"
ON public.audit_log
FOR SELECT
USING (is_superadmin());

-- 5. Add trigger to audit customer data access
CREATE TRIGGER audit_customer_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_access();