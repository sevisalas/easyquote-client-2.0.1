-- Fix the search path security warnings for existing functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Fix the get_integration_status function with proper search path
CREATE OR REPLACE FUNCTION get_integration_status(org_id uuid, integration_name text)
RETURNS TABLE(
  id uuid,
  integration_type text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
  SELECT 
    i.id,
    i.integration_type,
    i.is_active,
    i.created_at,
    i.updated_at
  FROM integrations i
  WHERE i.organization_id = org_id 
    AND i.integration_type = integration_name
    AND (
      EXISTS (SELECT 1 FROM organizations o WHERE o.id = org_id AND o.api_user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = org_id AND om.user_id = auth.uid()) OR
      is_superadmin()
    );
$$;