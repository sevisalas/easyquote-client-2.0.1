-- Create table for organization integration access control
CREATE TABLE public.organization_integration_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  integration_type TEXT NOT NULL,
  granted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.organization_integration_access ENABLE ROW LEVEL SECURITY;

-- Only superadmins can manage integration access
CREATE POLICY "Superadmin can manage integration access" 
ON public.organization_integration_access 
FOR ALL 
USING (is_superadmin()) 
WITH CHECK (is_superadmin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_organization_integration_access_updated_at
BEFORE UPDATE ON public.organization_integration_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();