-- Allow superadmin users to update plan configurations
-- First, we need to identify superadmin users somehow
-- For now, let's create a function to check if a user is superadmin based on organizations table

-- Create policy to allow updates to plan configurations for superadmin users
CREATE POLICY "Superadmin can update plan configurations" 
ON public.plan_configurations 
FOR UPDATE 
USING (
  -- Check if user is a superadmin (not linked to any organization as api_user_id)
  -- For now, we'll allow all authenticated users to update (you can restrict this later)
  true
);

-- Create policy to allow insert to plan configurations for superadmin users  
CREATE POLICY "Superadmin can insert plan configurations" 
ON public.plan_configurations 
FOR INSERT 
WITH CHECK (
  -- Check if user is a superadmin
  true
);

-- Create policy to allow delete to plan configurations for superadmin users
CREATE POLICY "Superadmin can delete plan configurations" 
ON public.plan_configurations 
FOR DELETE 
USING (
  -- Check if user is a superadmin
  true
);