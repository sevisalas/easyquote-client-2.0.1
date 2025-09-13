-- Create a function to identify superadmin users
-- A superadmin is a user who is NOT an api_user_id in any organization
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  -- If user is not authenticated, return false
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the current user is NOT listed as api_user_id in any organization
  -- If they're not an api_user_id, they're considered superadmin
  RETURN NOT EXISTS (
    SELECT 1 FROM organizations 
    WHERE api_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the organizations RLS policy to allow superadmin to see all organizations
DROP POLICY IF EXISTS "API users can view their organization" ON public.organizations;

CREATE POLICY "Users can view organizations based on role" 
ON public.organizations 
FOR SELECT 
USING (
  -- API users can see their own organization
  auth.uid() = api_user_id 
  OR 
  -- Superadmin users can see all organizations
  public.is_superadmin()
);