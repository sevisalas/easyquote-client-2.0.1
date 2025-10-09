-- Create holded_contacts table for imported Holded contacts
CREATE TABLE IF NOT EXISTS public.holded_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holded_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(holded_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.holded_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their organization's Holded contacts"
  ON public.holded_contacts
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE api_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert Holded contacts for their organization"
  ON public.holded_contacts
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations WHERE api_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's Holded contacts"
  ON public.holded_contacts
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE api_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organization's Holded contacts"
  ON public.holded_contacts
  FOR DELETE
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE api_user_id = auth.uid()
    )
  );

-- Create index for faster searches
CREATE INDEX idx_holded_contacts_name ON public.holded_contacts(name);
CREATE INDEX idx_holded_contacts_email ON public.holded_contacts(email);
CREATE INDEX idx_holded_contacts_organization ON public.holded_contacts(organization_id);

-- Create trigger for updated_at
CREATE TRIGGER update_holded_contacts_updated_at
  BEFORE UPDATE ON public.holded_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();