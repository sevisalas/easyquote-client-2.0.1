-- Add modules column to plan_configurations table
ALTER TABLE public.plan_configurations 
ADD COLUMN available_modules TEXT[] DEFAULT ARRAY['API', 'Client'];

-- Update existing plans with appropriate modules
UPDATE public.plan_configurations 
SET available_modules = CASE 
  WHEN plan_id LIKE 'api_%' THEN ARRAY['API']
  WHEN plan_id LIKE 'client_%' THEN ARRAY['Client'] 
  WHEN plan_id = 'custom' THEN ARRAY['API', 'Client']
  ELSE ARRAY['API', 'Client']
END;