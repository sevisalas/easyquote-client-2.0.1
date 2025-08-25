-- Create table for integration configurations
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  integration_type TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for integrations
CREATE POLICY "Organization members can view integrations" 
ON public.integrations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = integrations.organization_id 
    AND o.api_user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('admin', 'user')
  ) OR
  is_superadmin()
);

CREATE POLICY "Organization admins can manage integrations" 
ON public.integrations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = integrations.organization_id 
    AND o.api_user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = integrations.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'admin'
  ) OR
  is_superadmin()
);

-- Add trigger for updated_at
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();