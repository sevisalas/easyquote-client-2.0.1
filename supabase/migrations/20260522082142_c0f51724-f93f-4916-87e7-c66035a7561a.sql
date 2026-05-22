CREATE TYPE public.production_resource_type AS ENUM ('machine', 'manual');

CREATE TABLE public.production_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resource_type public.production_resource_type NOT NULL DEFAULT 'machine',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_resources_org ON public.production_resources(organization_id);

ALTER TABLE public.production_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view production resources"
ON public.production_resources FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = production_resources.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Admin/Gestor can insert production resources"
ON public.production_resources FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = production_resources.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor','superadmin')
  )
);

CREATE POLICY "Admin/Gestor can update production resources"
ON public.production_resources FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = production_resources.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor','superadmin')
  )
);

CREATE POLICY "Admin/Gestor can delete production resources"
ON public.production_resources FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = production_resources.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin','gestor','superadmin')
  )
);

CREATE TRIGGER update_production_resources_updated_at
BEFORE UPDATE ON public.production_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();