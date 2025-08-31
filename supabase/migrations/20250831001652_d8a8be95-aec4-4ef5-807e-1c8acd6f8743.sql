-- Fix all remaining functions with search path issues
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

CREATE OR REPLACE FUNCTION public.get_customer_public_info(customer_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, name text, user_id uuid, created_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    c.id,
    c.name,
    c.user_id,
    c.created_at
  FROM public.customers c
  WHERE 
    c.user_id = auth.uid() 
    AND (customer_id IS NULL OR c.id = customer_id);
$function$;