
-- Table for storing SMTP credentials per organization
CREATE TABLE public.organization_smtp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password_encrypted TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  use_tls BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.organization_smtp_settings ENABLE ROW LEVEL SECURITY;

-- Only org admins can view SMTP settings
CREATE POLICY "Org admins can view smtp settings"
  ON public.organization_smtp_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR public.is_superadmin()
  );

-- Only org admins can insert SMTP settings
CREATE POLICY "Org admins can insert smtp settings"
  ON public.organization_smtp_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR public.is_superadmin()
  );

-- Only org admins can update SMTP settings
CREATE POLICY "Org admins can update smtp settings"
  ON public.organization_smtp_settings
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR public.is_superadmin()
  );

-- Only org admins can delete SMTP settings
CREATE POLICY "Org admins can delete smtp settings"
  ON public.organization_smtp_settings
  FOR DELETE
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.is_organization_owner(auth.uid(), organization_id)
    OR public.is_superadmin()
  );

-- Trigger for updated_at
CREATE TRIGGER update_organization_smtp_settings_updated_at
  BEFORE UPDATE ON public.organization_smtp_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
