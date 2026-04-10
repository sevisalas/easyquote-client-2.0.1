
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL DEFAULT 'quote_sent',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, template_key)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org email templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert their org email templates"
  ON public.email_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Members can update their org email templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (public.is_organization_member(auth.uid(), organization_id));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
