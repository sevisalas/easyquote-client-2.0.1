-- Create security definer function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  RETURN user_email = 'vdp@tradsis.net';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update RLS policies to use the function instead of direct auth.users access

-- Drop existing superadmin policies
DROP POLICY IF EXISTS "superadmin_all_access_orgs" ON organizations;
DROP POLICY IF EXISTS "superadmin_all_access_members" ON organization_members;

-- Create new superadmin policies using the function
CREATE POLICY "superadmin_all_access_orgs" 
ON organizations 
FOR ALL 
USING (public.is_superadmin());

CREATE POLICY "superadmin_all_access_members" 
ON organization_members 
FOR ALL 
USING (public.is_superadmin());