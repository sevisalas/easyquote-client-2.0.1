-- Create API credentials table for organizations
CREATE TABLE public.organization_api_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  api_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.organization_api_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for organization API credentials
CREATE POLICY "Organization members can view API credentials" 
ON public.organization_api_credentials 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  ) OR 
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can create API credentials" 
ON public.organization_api_credentials 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update API credentials" 
ON public.organization_api_credentials 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can delete API credentials" 
ON public.organization_api_credentials 
FOR DELETE 
USING (
  organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  )
);

-- Create function to generate API key
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT AS $$
BEGIN
  RETURN 'eq_' || encode(gen_random_bytes(24), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Create function to generate API secret
CREATE OR REPLACE FUNCTION public.generate_api_secret()
RETURNS TEXT AS $$
BEGIN
  RETURN 'eqs_' || encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_organization_api_credentials_updated_at
BEFORE UPDATE ON public.organization_api_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_organization_api_credentials_api_key ON public.organization_api_credentials(api_key);
CREATE INDEX idx_organization_api_credentials_organization_id ON public.organization_api_credentials(organization_id);