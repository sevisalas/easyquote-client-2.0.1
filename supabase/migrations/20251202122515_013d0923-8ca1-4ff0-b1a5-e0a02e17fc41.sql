-- Create organization_themes table for tenant-level theme customization
CREATE TABLE IF NOT EXISTS public.organization_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Tema corporativo',
  primary_color TEXT NOT NULL DEFAULT '217 91% 60%', -- HSL format without hsl()
  secondary_color TEXT NOT NULL DEFAULT '210 40% 98%',
  accent_color TEXT NOT NULL DEFAULT '217 91% 60%',
  muted_color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for organization_themes
ALTER TABLE public.organization_themes ENABLE ROW LEVEL SECURITY;

-- Organization owners can view their theme
CREATE POLICY "Organization owners can view their theme"
  ON public.organization_themes
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

-- Organization members can view their organization's theme
CREATE POLICY "Organization members can view organization theme"
  ON public.organization_themes
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Organization owners can insert their theme
CREATE POLICY "Organization owners can insert their theme"
  ON public.organization_themes
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

-- Organization owners can update their theme
CREATE POLICY "Organization owners can update their theme"
  ON public.organization_themes
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

-- Organization owners can delete their theme
CREATE POLICY "Organization owners can delete their theme"
  ON public.organization_themes
  FOR DELETE
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_organization_themes_updated_at
  BEFORE UPDATE ON public.organization_themes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_organization_themes_organization_id ON public.organization_themes(organization_id);
CREATE INDEX idx_organization_themes_is_active ON public.organization_themes(is_active);