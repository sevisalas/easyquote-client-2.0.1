-- Drop the security definer view that was flagged
DROP VIEW IF EXISTS integration_metadata;

-- Update the existing is_superadmin function to fix search path
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